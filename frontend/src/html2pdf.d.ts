declare module 'html2pdf.js' {
    interface Html2PdfOptions {
        margin?: number | [number, number, number, number];
        filename?: string;
        image?: {
            type?: string;
            quality?: number;
        };
        enableLinks?: boolean;
        html2canvas?: {
            scale?: number;
            useCORS?: boolean;
            logging?: boolean;
            [key: string]: any;
        };
        jsPDF?: {
            unit?: string;
            format?: string;
            orientation?: 'portrait' | 'landscape';
            compress?: boolean;
            [key: string]: any;
        };
        pagebreak?: {
            mode?: 'avoid-all' | 'css' | 'legacy';
            before?: string;
            after?: string;
            avoid?: string;
        };
        [key: string]: any;
    }

    interface Html2PdfInstance {
        from(element: HTMLElement | string): Html2PdfInstance;
        set(options: Html2PdfOptions): Html2PdfInstance;
        save(): Promise<void>;
        toPdf(): any;
        get(type: string): Promise<any>;
        outputPdf(type?: string): any;
        output(type?: string): Promise<any>;
    }

    function html2pdf(): Html2PdfInstance;
    function html2pdf(element: HTMLElement | string, options?: Html2PdfOptions): Html2PdfInstance;

    export default html2pdf;
}
