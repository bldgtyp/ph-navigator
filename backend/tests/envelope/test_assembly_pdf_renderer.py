from __future__ import annotations

import pypdfium2 as pdfium

from features.envelope.assembly_pdf import render_renderer_proof


def test_renderer_proof_is_deterministic_vector_pdf_with_selectable_text() -> None:
    first = render_renderer_proof()
    second = render_renderer_proof()

    assert first == second
    assert first.startswith(b"%PDF-")
    assert b"/FontFile2" in first
    assert b"/Subtype /Image" not in first

    document = pdfium.PdfDocument(first)
    assert len(document) == 1
    text_page = document[0].get_textpage()
    text = text_page.get_text_range()
    assert "Assembly renderer proof" in text
    assert "Exterior" in text
    assert "Interior" in text
    assert "Dense-pack cellulose" in text
    assert "Conductivity" in text
