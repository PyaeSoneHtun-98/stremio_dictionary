"""Package the existing per-size PNG exports without resampling them."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent
sizes = [16, 24, 32, 48, 64, 128, 256]
images = [Image.open(root / f'exports/icon-{size}.png').convert('RGBA') for size in sizes]
images[-1].save(root / 'subtitle-bridge-icon.ico', format='ICO',
                sizes=[(size, size) for size in sizes], append_images=images[:-1])
with Image.open(root / 'subtitle-bridge-icon.ico') as result:
    assert result.ico.sizes() == {(size, size) for size in sizes}
    for size, image in zip(sizes, images):
        assert result.ico.getimage((size, size)).tobytes() == image.tobytes()
print('ICO verified: 7 alpha-enabled frames exactly match the PNG exports.')
