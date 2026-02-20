/** Pinned property bookmark */
export interface Pin {
  control: string
  prop: string
  /** Stable control identifier (data-fui-tree-item-value) for rename tracking */
  controlId?: string
}

/** Message types exchanged between background and content scripts */
export type PaffMessageType = 'PAFF_DETACH_FORMULA' | 'PAFF_GET_TAB_URL'

export interface PaffMessage {
  type: PaffMessageType
}

export interface PaffTabUrlResponse {
  url: string | null
}
