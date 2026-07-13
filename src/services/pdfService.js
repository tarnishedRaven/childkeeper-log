import jsPDF from "jspdf";
import html2canvas from "html2canvas";

function toScaledTop(root, node, scaleY) {
  if (!root || !node) {
    return null;
  }

  if (typeof root.getBoundingClientRect === "function" && typeof node.getBoundingClientRect === "function") {
    const rootRect = root.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();
    return Math.max(0, Math.round((nodeRect.top - rootRect.top + (root.scrollTop || 0)) * scaleY));
  }

  if (typeof node.offsetTop === "number") {
    return Math.max(0, Math.round(node.offsetTop * scaleY));
  }

  return null;
}

function getBreakHints(element, canvasHeight) {
  const sourceHeight = element?.scrollHeight || element?.offsetHeight || canvasHeight;
  const scaleY = sourceHeight > 0 ? canvasHeight / sourceHeight : 1;

  const forceBreaks = Array.from(element?.querySelectorAll?.(".pdf-page-break-before") || [])
    .map((node) => toScaledTop(element, node, scaleY))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);

  const avoidRegions = Array.from(element?.querySelectorAll?.(".pdf-avoid-break") || [])
    .map((node) => {
      const top = toScaledTop(element, node, scaleY);
      const nodeHeight = typeof node.offsetHeight === "number"
        ? Math.round(node.offsetHeight * scaleY)
        : (typeof node.getBoundingClientRect === "function"
            ? Math.round(node.getBoundingClientRect().height * scaleY)
            : 0);

      if (!Number.isFinite(top) || nodeHeight <= 0) {
        return null;
      }

      return {
        top,
        bottom: top + nodeHeight,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.top - b.top);

  return { forceBreaks, avoidRegions };
}

function computePageCuts(totalHeightPx, pageHeightPx, forceBreaks, avoidRegions) {
  const cuts = [];
  const minSlicePx = Math.floor(pageHeightPx * 0.45);
  let start = 0;

  while (start < totalHeightPx) {
    const idealEnd = Math.min(start + pageHeightPx, totalHeightPx);
    if (idealEnd >= totalHeightPx) {
      cuts.push([start, totalHeightPx]);
      break;
    }

    let end = idealEnd;

    const forced = forceBreaks.filter((point) => point > start + Math.floor(pageHeightPx * 0.2) && point <= idealEnd);
    if (forced.length > 0) {
      end = forced[forced.length - 1];
    }

    const crossingRegion = avoidRegions.find(
      (region) => region.top < end && region.bottom > end && region.top > start + Math.floor(pageHeightPx * 0.25),
    );
    if (crossingRegion) {
      end = Math.max(start + minSlicePx, crossingRegion.top);
    }

    if (end <= start) {
      end = idealEnd;
    }

    cuts.push([start, end]);
    start = end;
  }

  return cuts;
}

/**
 * Export HTML element to PDF
 * @param {HTMLElement} element - HTML element to capture
 * @param {string} filename - PDF filename
 * @returns {Promise<void>}
 */
export async function exportElementToPdf(element, filename) {
  if (!element) {
    throw new Error("Element is required");
  }

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
    });

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const marginMm = 10;
    const pageWidthMm = pdf.internal.pageSize.getWidth() - marginMm * 2;
    const pageHeightMm = pdf.internal.pageSize.getHeight() - marginMm * 2;
    const pixelsPerMm = canvas.width / pageWidthMm;
    const pageHeightPx = Math.max(1, Math.floor(pageHeightMm * pixelsPerMm));

    const { forceBreaks, avoidRegions } = getBreakHints(element, canvas.height);
    const slices = computePageCuts(canvas.height, pageHeightPx, forceBreaks, avoidRegions);

    slices.forEach(([startPx, endPx], index) => {
      const sliceHeightPx = Math.max(1, endPx - startPx);
      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeightPx;

      const ctx = pageCanvas.getContext("2d");
      if (!ctx) {
        throw new Error("Unable to render PDF page");
      }

      ctx.drawImage(
        canvas,
        0,
        startPx,
        canvas.width,
        sliceHeightPx,
        0,
        0,
        canvas.width,
        sliceHeightPx,
      );

      const imgData = pageCanvas.toDataURL("image/png");
      const sliceHeightMm = sliceHeightPx / pixelsPerMm;

      if (index > 0) {
        pdf.addPage();
      }

      pdf.addImage(imgData, "PNG", marginMm, marginMm, pageWidthMm, sliceHeightMm);
    });

    pdf.save(filename);
  } catch (error) {
    throw new Error(`Failed to generate PDF: ${error.message}`);
  }
}

/**
 * Generate summary report PDF
 * @param {string} startDate - Start date for report (YYYY-MM-DD format)
 * @param {string} endDate - End date for report (YYYY-MM-DD format)
 * @param {'report' | 'receipt'} documentType - Document type for filename prefix
 * @returns {string} PDF filename
 */
export function generateReportPdfFilename(startDate, endDate, documentType = "report") {
  try {
    // Parse date string directly to avoid timezone issues
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    // Extract YYYY and MM from YYYY-MM-DD format
    const match = startDate.match(/^(\d{4})-(\d{2})/);
    if (!match) {
      return documentType === "receipt"
        ? "ChildkeeperLog-Receipt.pdf"
        : "ChildkeeperLog-Report.pdf";
    }

    const year = match[1];
    const monthIndex = parseInt(match[2], 10) - 1;

    if (monthIndex < 0 || monthIndex > 11) {
      return documentType === "receipt"
        ? "ChildkeeperLog-Receipt.pdf"
        : "ChildkeeperLog-Report.pdf";
    }

    const month = months[monthIndex];
    const prefix = documentType === "receipt" ? "Receipt" : "Report";
    return `ChildkeeperLog-${prefix}-${month}-${year}.pdf`;
  } catch (error) {
    return documentType === "receipt"
      ? "ChildkeeperLog-Receipt.pdf"
      : "ChildkeeperLog-Report.pdf";
  }
}

/**
 * Validate that element exists and has content
 * @param {HTMLElement} element - Element to validate
 * @throws {Error} if element invalid
 */
export function validateExportElement(element) {
  if (!element) {
    throw new Error("Element to export is required");
  }

  if (element.innerHTML.trim() === "") {
    throw new Error("Nothing to export - element is empty");
  }
}
