export type PlayerIconName =
  | 'play'
  | 'pause'
  | 'volume'
  | 'captions'
  | 'settings'
  | 'fullscreen'
  | 'folder'
  | 'close'
  | 'back'
  | 'forward'
  | 'keyboard'

const paths: Record<PlayerIconName, string> = {
  play: 'm9 5 11 7-11 7Z',
  pause: 'M8 5v14M16 5v14',
  volume: 'M11 4 6 8H3v8h3l5 4ZM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14',
  captions: 'M4 5h16v14H4ZM10 10H7v4h3M17 10h-3v4h3',
  settings:
    'M9 4 10 2h4l1 2 2 1 2 0 2 4-1 2v2l1 2-2 4h-2l-2 1-1 2h-4l-1-2-2-1H5l-2-4 1-2v-2L3 9l2-4h2ZM15 12a3 3 0 1 0-6 0 3 3 0 0 0 6 0',
  fullscreen: 'M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5',
  folder: 'M3 7V5h6l2 2h10v13H3ZM3 10h18',
  close: 'm6 6 12 12M6 18 18 6',
  back: 'M4 9a8 8 0 1 1 0 7M4 3v6h6',
  forward: 'M20 9a8 8 0 1 0 0 7M20 3v6h-6',
  keyboard:
    'M2 5h20v14H2ZM6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M10 13h.01M14 13h.01M18 13h.01M8 16h8',
}

export function PlayerIcon({ name }: { name: PlayerIconName }): React.JSX.Element {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  )
}
