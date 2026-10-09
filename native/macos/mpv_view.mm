// Subtitle Bridge macOS video view (Issue #53).
//
// mpv cannot embed into another process's window on macOS (`--wid` is not supported there), so
// the macOS build runs libmpv inside the Electron main process and draws frames into a
// CAOpenGLLayer-backed view added to the player host window's content view, using mpv's
// documented render API (the approach used by IINA). libmpv is loaded at runtime from the path
// chosen by the app (Homebrew), so the app itself starts without mpv installed.
//
// Control stays on mpv's JSON IPC socket (`input-ipc-server`), exactly like the Windows build.
// Every exported function must be called on the main thread, which is where Electron runs
// main-process JavaScript.

#define GL_SILENCE_DEPRECATION

#import <Cocoa/Cocoa.h>
#import <OpenGL/OpenGL.h>
#import <OpenGL/gl3.h>
#import <QuartzCore/QuartzCore.h>

#include <dlfcn.h>
#include <mpv/client.h>
#include <mpv/render_gl.h>
#include <node_api.h>

#include <algorithm>
#include <atomic>
#include <cstdlib>
#include <mutex>
#include <string>
#include <utility>
#include <vector>

@class SBVideoLayer;
@class SBVideoView;

namespace sbmpv {

struct MpvApi {
  void *library = nullptr;
  decltype(&mpv_create) create = nullptr;
  decltype(&mpv_set_option_string) setOptionString = nullptr;
  decltype(&mpv_initialize) initialize = nullptr;
  decltype(&mpv_wait_event) waitEvent = nullptr;
  decltype(&mpv_terminate_destroy) terminateDestroy = nullptr;
  decltype(&mpv_error_string) errorString = nullptr;
  decltype(&mpv_render_context_create) renderCreate = nullptr;
  decltype(&mpv_render_context_set_update_callback) renderSetUpdateCallback = nullptr;
  decltype(&mpv_render_context_render) renderRender = nullptr;
  decltype(&mpv_render_context_free) renderFree = nullptr;
};

MpvApi g_api;

struct Player {
  mpv_handle *mpv = nullptr;
  mpv_render_context *render = nullptr;
  CGLContextObj glContext = nullptr;
  std::mutex renderLock;
  SBVideoView *view = nil;
  SBVideoLayer *layer = nil;
  NSTimer *eventTimer = nil;
  std::string renderer = "pending";
  std::atomic<uint64_t> frames{0};
  std::atomic<int> width{0};
  std::atomic<int> height{0};
  std::atomic<double> meanLuma{-1};
  bool probe = false;
  bool destroyed = false;
};

bool LoadLibmpv(const std::string &path, std::string &error) {
  if (g_api.library) {
    return true;
  }

  void *library = dlopen(path.c_str(), RTLD_NOW | RTLD_LOCAL);
  if (!library) {
    error = "libmpv could not be loaded.";
    return false;
  }

  MpvApi api;
  api.library = library;
#define SB_LOAD(field, symbol)                                                   \
  api.field = reinterpret_cast<decltype(api.field)>(dlsym(library, symbol));     \
  if (!api.field) {                                                              \
    error = "The installed libmpv is missing " symbol ".";                       \
    dlclose(library);                                                            \
    return false;                                                                \
  }
  SB_LOAD(create, "mpv_create")
  SB_LOAD(setOptionString, "mpv_set_option_string")
  SB_LOAD(initialize, "mpv_initialize")
  SB_LOAD(waitEvent, "mpv_wait_event")
  SB_LOAD(terminateDestroy, "mpv_terminate_destroy")
  SB_LOAD(errorString, "mpv_error_string")
  SB_LOAD(renderCreate, "mpv_render_context_create")
  SB_LOAD(renderSetUpdateCallback, "mpv_render_context_set_update_callback")
  SB_LOAD(renderRender, "mpv_render_context_render")
  SB_LOAD(renderFree, "mpv_render_context_free")
#undef SB_LOAD

  g_api = api;
  return true;
}

void *GetGlProcAddress(void *, const char *name) {
  static void *openGl =
      dlopen("/System/Library/Frameworks/OpenGL.framework/OpenGL", RTLD_LAZY | RTLD_LOCAL);
  return openGl ? dlsym(openGl, name) : nullptr;
}

void OnRenderUpdate(void *context);

}  // namespace sbmpv

@interface SBVideoLayer : CAOpenGLLayer
@property(nonatomic, assign) sbmpv::Player *player;
@end

@implementation SBVideoLayer

- (instancetype)init {
  self = [super init];
  if (self) {
    self.asynchronous = NO;
    self.needsDisplayOnBoundsChange = YES;
    self.opaque = YES;
    self.backgroundColor = NSColor.blackColor.CGColor;
  }
  return self;
}

- (CGLPixelFormatObj)copyCGLPixelFormatForDisplayMask:(uint32_t)mask {
  CGLPixelFormatAttribute accelerated[] = {
      kCGLPFAOpenGLProfile, (CGLPixelFormatAttribute)kCGLOGLPVersion_3_2_Core,
      kCGLPFAAccelerated, kCGLPFADoubleBuffer, kCGLPFAAllowOfflineRenderers,
      kCGLPFASupportsAutomaticGraphicsSwitching, (CGLPixelFormatAttribute)0};
  // Fallback for machines without a usable GPU (for example CI virtual machines).
  CGLPixelFormatAttribute software[] = {
      kCGLPFAOpenGLProfile, (CGLPixelFormatAttribute)kCGLOGLPVersion_3_2_Core,
      kCGLPFARendererID, (CGLPixelFormatAttribute)kCGLRendererGenericFloatID,
      kCGLPFADoubleBuffer, (CGLPixelFormatAttribute)0};

  CGLPixelFormatObj pixelFormat = nullptr;
  GLint count = 0;
  if (CGLChoosePixelFormat(accelerated, &pixelFormat, &count) != kCGLNoError || !pixelFormat) {
    pixelFormat = nullptr;
    CGLChoosePixelFormat(software, &pixelFormat, &count);
  }
  return pixelFormat;
}

- (CGLContextObj)copyCGLContextForPixelFormat:(CGLPixelFormatObj)pixelFormat {
  CGLContextObj context = [super copyCGLContextForPixelFormat:pixelFormat];
  sbmpv::Player *player = self.player;
  if (!context || !player) {
    return context;
  }

  std::lock_guard<std::mutex> lock(player->renderLock);
  if (player->render || !player->mpv) {
    return context;
  }

  GLint swapInterval = 1;
  CGLSetParameter(context, kCGLCPSwapInterval, &swapInterval);
  CGLSetCurrentContext(context);

  mpv_opengl_init_params glInit{};
  glInit.get_proc_address = sbmpv::GetGlProcAddress;
  glInit.get_proc_address_ctx = nullptr;
  mpv_render_param params[] = {
      {MPV_RENDER_PARAM_API_TYPE, const_cast<char *>(MPV_RENDER_API_TYPE_OPENGL)},
      {MPV_RENDER_PARAM_OPENGL_INIT_PARAMS, &glInit},
      {MPV_RENDER_PARAM_INVALID, nullptr}};

  if (sbmpv::g_api.renderCreate(&player->render, player->mpv, params) < 0) {
    player->render = nullptr;
    player->renderer = "render-context-failed";
    return context;
  }

  player->glContext = CGLRetainContext(context);
  const GLubyte *name = glGetString(GL_RENDERER);
  player->renderer = name ? reinterpret_cast<const char *>(name) : "unknown";
  sbmpv::g_api.renderSetUpdateCallback(player->render, sbmpv::OnRenderUpdate,
                                       (__bridge void *)self);
  return context;
}

- (void)drawInCGLContext:(CGLContextObj)context
             pixelFormat:(CGLPixelFormatObj)pixelFormat
            forLayerTime:(CFTimeInterval)layerTime
             displayTime:(const CVTimeStamp *)displayTime {
  CGLSetCurrentContext(context);
  GLint framebuffer = 0;
  glGetIntegerv(GL_FRAMEBUFFER_BINDING, &framebuffer);
  GLint viewport[4] = {0, 0, 0, 0};
  glGetIntegerv(GL_VIEWPORT, viewport);

  bool rendered = false;
  sbmpv::Player *player = self.player;
  if (player) {
    std::lock_guard<std::mutex> lock(player->renderLock);
    if (player->render && viewport[2] > 0 && viewport[3] > 0) {
      mpv_opengl_fbo target{static_cast<int>(framebuffer), viewport[2], viewport[3], 0};
      int flipY = 1;
      mpv_render_param params[] = {{MPV_RENDER_PARAM_OPENGL_FBO, &target},
                                   {MPV_RENDER_PARAM_FLIP_Y, &flipY},
                                   {MPV_RENDER_PARAM_INVALID, nullptr}};
      sbmpv::g_api.renderRender(player->render, params);
      rendered = true;

      const uint64_t frame = ++player->frames;
      player->width = viewport[2];
      player->height = viewport[3];
      if (player->probe && frame % 30 == 1) {
        // Diagnostics only: mean brightness of a small centre sample, never frame content.
        const int sampleWidth = std::min(64, static_cast<int>(viewport[2]));
        const int sampleHeight = std::min(64, static_cast<int>(viewport[3]));
        std::vector<unsigned char> pixels(static_cast<size_t>(sampleWidth) * sampleHeight * 4);
        glReadPixels((viewport[2] - sampleWidth) / 2, (viewport[3] - sampleHeight) / 2, sampleWidth,
                     sampleHeight, GL_RGBA, GL_UNSIGNED_BYTE, pixels.data());
        double total = 0;
        for (size_t index = 0; index < pixels.size(); index += 4) {
          total += 0.299 * pixels[index] + 0.587 * pixels[index + 1] + 0.114 * pixels[index + 2];
        }
        player->meanLuma = total / (static_cast<double>(pixels.size()) / 4);
      }
    }
  }

  if (!rendered) {
    glClearColor(0, 0, 0, 1);
    glClear(GL_COLOR_BUFFER_BIT);
  }

  [super drawInCGLContext:context
              pixelFormat:pixelFormat
             forLayerTime:layerTime
              displayTime:displayTime];
}

@end

@interface SBVideoView : NSView
@end

@implementation SBVideoView

- (CALayer *)makeBackingLayer {
  return [SBVideoLayer layer];
}

- (BOOL)acceptsFirstResponder {
  return NO;
}

- (NSView *)hitTest:(NSPoint)point {
  return nil;
}

- (void)viewDidChangeBackingProperties {
  [super viewDidChangeBackingProperties];
  CGFloat scale = self.window ? self.window.backingScaleFactor : 1;
  self.layer.contentsScale = scale > 0 ? scale : 1;
  [self.layer setNeedsDisplay];
}

@end

namespace sbmpv {

void OnRenderUpdate(void *context) {
  // Called on an mpv thread. mpv holds its update lock here, and destruction clears this
  // callback first, so the layer is still alive while the weak reference is formed.
  __weak SBVideoLayer *layer = (__bridge SBVideoLayer *)context;
  dispatch_async(dispatch_get_main_queue(), ^{
    [layer setNeedsDisplay];
  });
}

void DrainEvents(Player *player) {
  if (!player->mpv) {
    return;
  }
  for (int index = 0; index < 256; index += 1) {
    mpv_event *event = g_api.waitEvent(player->mpv, 0);
    if (!event || event->event_id == MPV_EVENT_NONE) {
      return;
    }
  }
}

void Destroy(Player *player) {
  if (player->destroyed) {
    return;
  }
  player->destroyed = true;

  [player->eventTimer invalidate];
  player->eventTimer = nil;
  player->layer.player = nullptr;

  {
    std::lock_guard<std::mutex> lock(player->renderLock);
    if (player->render) {
      g_api.renderSetUpdateCallback(player->render, nullptr, nullptr);
      if (player->glContext) {
        CGLSetCurrentContext(player->glContext);
      }
      // The render context must be freed before the core is destroyed.
      g_api.renderFree(player->render);
      player->render = nullptr;
      CGLSetCurrentContext(nullptr);
    }
    if (player->glContext) {
      CGLReleaseContext(player->glContext);
      player->glContext = nullptr;
    }
  }

  [player->view removeFromSuperview];
  player->view = nil;
  player->layer = nil;

  if (player->mpv) {
    g_api.terminateDestroy(player->mpv);
    player->mpv = nullptr;
  }
}

NSView *FindViewIn(NSView *view, uintptr_t target) {
  if (reinterpret_cast<uintptr_t>((__bridge void *)view) == target) {
    return view;
  }
  for (NSView *subview in view.subviews) {
    if (NSView *match = FindViewIn(subview, target)) {
      return match;
    }
  }
  return nil;
}

// Only pointer comparisons against views owned by this app; the id is never dereferenced.
NSView *FindHostView(const std::string &viewId) {
  char *end = nullptr;
  const unsigned long long raw = strtoull(viewId.c_str(), &end, 10);
  if (viewId.empty() || !end || *end != '\0' || raw == 0) {
    return nil;
  }
  const uintptr_t target = static_cast<uintptr_t>(raw);
  for (NSWindow *window in NSApp.windows) {
    NSView *root = window.contentView.superview ?: window.contentView;
    if (root) {
      if (NSView *match = FindViewIn(root, target)) {
        return match;
      }
    }
  }
  return nil;
}

napi_value ThrowError(napi_env env, const char *code, const std::string &message) {
  napi_throw_error(env, code, message.c_str());
  return nullptr;
}

bool ReadString(napi_env env, napi_value value, std::string &out) {
  size_t length = 0;
  if (napi_get_value_string_utf8(env, value, nullptr, 0, &length) != napi_ok) {
    return false;
  }
  std::vector<char> buffer(length + 1);
  size_t written = 0;
  if (napi_get_value_string_utf8(env, value, buffer.data(), buffer.size(), &written) != napi_ok) {
    return false;
  }
  out.assign(buffer.data(), written);
  return true;
}

bool ReadOptions(napi_env env, napi_value value,
                 std::vector<std::pair<std::string, std::string>> &out) {
  bool isArray = false;
  if (napi_is_array(env, value, &isArray) != napi_ok || !isArray) {
    return false;
  }
  uint32_t length = 0;
  napi_get_array_length(env, value, &length);
  for (uint32_t index = 0; index < length; index += 1) {
    napi_value pair;
    napi_value name;
    napi_value data;
    std::string nameText;
    std::string dataText;
    if (napi_get_element(env, value, index, &pair) != napi_ok ||
        napi_get_element(env, pair, 0, &name) != napi_ok ||
        napi_get_element(env, pair, 1, &data) != napi_ok || !ReadString(env, name, nameText) ||
        !ReadString(env, data, dataText)) {
      return false;
    }
    out.emplace_back(std::move(nameText), std::move(dataText));
  }
  return true;
}

void FinalizePlayer(napi_env, void *data, void *) {
  auto *player = static_cast<Player *>(data);
  Destroy(player);
  delete player;
}

Player *GetPlayer(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value argv[1];
  void *data = nullptr;
  if (napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr) != napi_ok || argc < 1 ||
      napi_get_value_external(env, argv[0], &data) != napi_ok || !data) {
    ThrowError(env, "EINVAL", "A video player handle is required.");
    return nullptr;
  }
  return static_cast<Player *>(data);
}

// createPlayer(libraryPath, viewId, options: [name, value][], probe) -> handle
napi_value CreatePlayer(napi_env env, napi_callback_info info) {
  if (![NSThread isMainThread]) {
    return ThrowError(env, "EINVAL", "The video player must be created on the main thread.");
  }

  size_t argc = 4;
  napi_value argv[4];
  napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);
  std::string libraryPath;
  std::string viewId;
  std::vector<std::pair<std::string, std::string>> options;
  bool probe = false;
  if (argc < 4 || !ReadString(env, argv[0], libraryPath) || !ReadString(env, argv[1], viewId) ||
      !ReadOptions(env, argv[2], options) || napi_get_value_bool(env, argv[3], &probe) != napi_ok) {
    return ThrowError(env, "EINVAL", "Invalid video player arguments.");
  }

  std::string error;
  if (!LoadLibmpv(libraryPath, error)) {
    return ThrowError(env, "ENOENT", error);
  }

  NSView *host = FindHostView(viewId);
  if (!host) {
    return ThrowError(env, "EINVAL", "The playback window is not available.");
  }

  mpv_handle *mpv = g_api.create();
  if (!mpv) {
    return ThrowError(env, "EMPV", "mpv could not be created.");
  }
  for (const auto &[name, data] : options) {
    const int result = g_api.setOptionString(mpv, name.c_str(), data.c_str());
    if (result < 0) {
      std::string message = "mpv rejected the " + name + " option: " + g_api.errorString(result);
      g_api.terminateDestroy(mpv);
      return ThrowError(env, "EMPV", message);
    }
  }
  const int initialized = g_api.initialize(mpv);
  if (initialized < 0) {
    std::string message = std::string("mpv could not start: ") + g_api.errorString(initialized);
    g_api.terminateDestroy(mpv);
    return ThrowError(env, "EMPV", message);
  }

  auto *player = new Player();
  player->mpv = mpv;
  player->probe = probe;

  SBVideoView *view = [[SBVideoView alloc] initWithFrame:host.bounds];
  view.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable;
  view.wantsLayer = YES;
  SBVideoLayer *layer = (SBVideoLayer *)view.layer;
  layer.player = player;
  CGFloat scale = host.window ? host.window.backingScaleFactor : 1;
  layer.contentsScale = scale > 0 ? scale : 1;
  player->view = view;
  player->layer = layer;
  // Topmost inside the host: the host has no other content (its background is drawn by Electron
  // underneath), and the interactive subtitle overlay is a separate child window above it.
  [host addSubview:view positioned:NSWindowAbove relativeTo:nil];
  [layer setNeedsDisplay];

  // libmpv's event queue must be drained by its client; poll it on the main run loop.
  NSTimer *timer = [NSTimer timerWithTimeInterval:0.05
                                          repeats:YES
                                            block:^(NSTimer *) {
                                              DrainEvents(player);
                                            }];
  [[NSRunLoop mainRunLoop] addTimer:timer forMode:NSRunLoopCommonModes];
  player->eventTimer = timer;

  napi_value handle;
  if (napi_create_external(env, player, FinalizePlayer, nullptr, &handle) != napi_ok) {
    Destroy(player);
    delete player;
    return ThrowError(env, "EMPV", "Could not create the video player handle.");
  }
  return handle;
}

napi_value DestroyPlayer(napi_env env, napi_callback_info info) {
  if (![NSThread isMainThread]) {
    return ThrowError(env, "EINVAL", "The video player must be destroyed on the main thread.");
  }
  if (Player *player = GetPlayer(env, info)) {
    Destroy(player);
  }
  return nullptr;
}

napi_value GetRenderStats(napi_env env, napi_callback_info info) {
  Player *player = GetPlayer(env, info);
  if (!player) {
    return nullptr;
  }

  std::string renderer;
  {
    std::lock_guard<std::mutex> lock(player->renderLock);
    renderer = player->renderer;
  }

  napi_value result;
  napi_value value;
  napi_create_object(env, &result);
  napi_create_string_utf8(env, renderer.c_str(), renderer.size(), &value);
  napi_set_named_property(env, result, "renderer", value);
  napi_create_double(env, static_cast<double>(player->frames.load()), &value);
  napi_set_named_property(env, result, "frames", value);
  napi_create_int32(env, player->width.load(), &value);
  napi_set_named_property(env, result, "width", value);
  napi_create_int32(env, player->height.load(), &value);
  napi_set_named_property(env, result, "height", value);
  napi_create_double(env, player->meanLuma.load(), &value);
  napi_set_named_property(env, result, "meanLuma", value);
  return result;
}

}  // namespace sbmpv

NAPI_MODULE_INIT() {
  napi_property_descriptor properties[] = {
      {"createPlayer", nullptr, sbmpv::CreatePlayer, nullptr, nullptr, nullptr, napi_default,
       nullptr},
      {"destroyPlayer", nullptr, sbmpv::DestroyPlayer, nullptr, nullptr, nullptr, napi_default,
       nullptr},
      {"getRenderStats", nullptr, sbmpv::GetRenderStats, nullptr, nullptr, nullptr, napi_default,
       nullptr}};
  napi_define_properties(env, exports, sizeof(properties) / sizeof(properties[0]), properties);
  return exports;
}
