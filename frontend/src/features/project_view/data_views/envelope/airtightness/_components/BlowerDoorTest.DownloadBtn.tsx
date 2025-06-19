import React from 'react';
import { Button } from '@mui/material';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import html2pdf from 'html2pdf.js';
import jsPDF from 'jspdf';

interface DownloadPdfButtonProps {
    targetElementId: string; // The ID of the element to convert to PDF
    filename?: string; // Optional: Custom filename for the PDF
}

interface t {
    margin: number;
    filename: string;
    image: {
        type: string;
        quality: number;
    };
    html2canvas: {
        scale: number;
        useCORS: boolean;
        logging: boolean;
    };
    jsPDF: {
        unit: string;
        format: string;
        orientation: 'portrait' | 'landscape';
    };
    pagebreak: { mode: 'avoid-all' };
}

const DownloadPdfButton: React.FC<DownloadPdfButtonProps> = ({ targetElementId, filename = 'checklist.pdf' }) => {
    const handleDownloadPdf = () => {
        // Get the element to be converted
        const element = document.getElementById(targetElementId);

        if (!element) {
            console.error(`Element with ID "${targetElementId}" not found.`);
            return;
        }

        // Configure html2pdf options
        const options: t = {
            margin: 10,
            filename: filename,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
                scale: 2,
                useCORS: true,
                logging: true,
            },
            jsPDF: {
                unit: 'mm',
                format: 'a4',
                orientation: 'portrait',
            },
            pagebreak: { mode: 'avoid-all' },
        };

        // Add a 'no-print' class to elements that should not be printed
        // We have to do this since html2pdf doesn't respect @media css rules
        // so we need to swap in the right class manually like this.
        const noPrintElements = document.querySelectorAll('.pdf-no-print');
        noPrintElements.forEach(el => {
            el.classList.add('no-print');
        });
        console.log(`Added 'no-print' class to ${noPrintElements.length} elements.`);

        // Generate and download the PDF
        html2pdf()
            .set(options)
            .from(element)
            .save()
            .then(() => {
                // Remove the 'no-print' class after download
                noPrintElements.forEach(el => {
                    el.classList.remove('no-print');
                });
            });
    };

    return (
        <Button
            sx={{ mb: 3 }}
            variant="contained"
            color="primary"
            startIcon={<FileDownloadIcon />}
            onClick={handleDownloadPdf}
        >
            Download as PDF
        </Button>
    );
};

export default DownloadPdfButton;
