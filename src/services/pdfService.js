import jsPDF from "jspdf";
import html2canvas from "html2canvas";

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
    // Capture the element as canvas
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({
      orientation: canvas.width > canvas.height ? "landscape" : "portrait",
      unit: "mm",
      format: "a4",
    });

    const imgWidth = pdf.internal.pageSize.getWidth();
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    // Add image to PDF, handling multiple pages if needed
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pdf.internal.pageSize.getHeight();

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pdf.internal.pageSize.getHeight();
    }

    pdf.save(filename);
  } catch (error) {
    throw new Error(`Failed to generate PDF: ${error.message}`);
  }
}

/**
 * Generate summary report PDF
 * @param {string} startDate - Start date for report (YYYY-MM-DD format)
 * @param {string} endDate - End date for report (YYYY-MM-DD format)
 * @returns {string} PDF filename
 */
export function generateReportPdfFilename(startDate, endDate) {
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
      return "ChildkeeperLog-Report.pdf";
    }

    const year = match[1];
    const monthIndex = parseInt(match[2], 10) - 1;

    if (monthIndex < 0 || monthIndex > 11) {
      return "ChildkeeperLog-Report.pdf";
    }

    const month = months[monthIndex];
    return `ChildkeeperLog-Report-${month}-${year}.pdf`;
  } catch (error) {
    return "ChildkeeperLog-Report.pdf";
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
