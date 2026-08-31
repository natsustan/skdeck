export type Page = 0 | 1 | 2 | 3;
export type InputMode =
  | {kind: 'url' | 'renameDeck'; value: string}
  | {kind: 'newDeck'; value: string; addSelected: boolean}
  | {kind: 'deleteDeck' | 'uninstallLibrary'; value: string};
