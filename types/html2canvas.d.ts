declare module 'html2canvas' {
  interface Html2CanvasOptions {
    backgroundColor?: string | null
    scale?: number
    useCORS?: boolean
    allowTaint?: boolean
    height?: number
    width?: number
    x?: number
    y?: number
  }

  function html2canvas(
    element: HTMLElement,
    options?: Html2CanvasOptions
  ): Promise<HTMLCanvasElement>

  export default html2canvas
} 