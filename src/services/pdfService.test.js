import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  exportElementToPdf,
  generateReportPdfFilename,
  validateExportElement,
} from "./pdfService";

const {
  jsPdfCtorMock,
  addImageMock,
  addPageMock,
  saveMock,
  html2canvasMock,
} = vi.hoisted(() => ({
  jsPdfCtorMock: vi.fn(),
  addImageMock: vi.fn(),
  addPageMock: vi.fn(),
  saveMock: vi.fn(),
  html2canvasMock: vi.fn(),
}));

vi.mock("jspdf", () => ({
  default: jsPdfCtorMock,
}));

vi.mock("html2canvas", () => ({
  default: html2canvasMock,
}));

describe("PDF Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    html2canvasMock.mockResolvedValue({
      width: 1000,
      height: 1200,
      getContext: vi.fn(),
      toDataURL: vi.fn(() => "data:image/png;base64,test"),
    });

    jsPdfCtorMock.mockImplementation(() => ({
      internal: {
        pageSize: {
          getWidth: () => 210,
          getHeight: () => 297,
        },
      },
      addImage: addImageMock,
      addPage: addPageMock,
      save: saveMock,
    }));

    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName) => {
      if (tagName !== "canvas") {
        return originalCreateElement(tagName);
      }

      return {
        width: 0,
        height: 0,
        getContext: vi.fn(() => ({ drawImage: vi.fn() })),
        toDataURL: vi.fn(() => "data:image/png;base64,slice"),
      };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("generateReportPdfFilename", () => {
    it("should generate filename with month and year", () => {
      const filename = generateReportPdfFilename("2025-06-01", "2025-06-30");

      expect(filename).toContain("ChildkeeperLog-Report");
      expect(filename).toContain("June");
      expect(filename).toContain("2025");
      expect(filename).toMatch(/\.pdf$/);
    });

    it("should handle different months", () => {
      const filename = generateReportPdfFilename("2025-01-01", "2025-01-31");

      expect(filename).toContain("January");
    });

    it("should generate receipt filename when document type is receipt", () => {
      const filename = generateReportPdfFilename("2025-06-01", "2025-06-30", "receipt");

      expect(filename).toContain("ChildkeeperLog-Receipt");
      expect(filename).toContain("June");
      expect(filename).toContain("2025");
      expect(filename).toMatch(/\.pdf$/);
    });

    it("should fallback to generic filename on error", () => {
      const filename = generateReportPdfFilename("invalid", "invalid");

      expect(filename).toBe("ChildkeeperLog-Report.pdf");
    });

    it("should fallback to receipt filename on invalid dates for receipt type", () => {
      const filename = generateReportPdfFilename("invalid", "invalid", "receipt");

      expect(filename).toBe("ChildkeeperLog-Receipt.pdf");
    });
  });

  describe("validateExportElement", () => {
    it("should accept valid element", () => {
      const element = { innerHTML: "<table><tr><td>Data</td></tr></table>" };

      expect(() => validateExportElement(element)).not.toThrow();
    });

    it("should throw error for null element", () => {
      expect(() => validateExportElement(null)).toThrow(
        "Element to export is required",
      );
    });

    it("should throw error for undefined element", () => {
      expect(() => validateExportElement(undefined)).toThrow(
        "Element to export is required",
      );
    });

    it("should throw error for empty element", () => {
      const element = { innerHTML: "   " };

      expect(() => validateExportElement(element)).toThrow("Nothing to export");
    });
  });

  describe("exportElementToPdf", () => {
    it("should throw error for null element", async () => {
      await expect(exportElementToPdf(null, "test.pdf")).rejects.toThrow(
        "Element is required",
      );
    });

    it("should render element to paginated PDF slices and save file", async () => {
      const element = { innerHTML: "<table><tr><td>Data</td></tr></table>" };

      await exportElementToPdf(element, "test.pdf");

      expect(jsPdfCtorMock).toHaveBeenCalledWith({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      expect(html2canvasMock).toHaveBeenCalledTimes(1);
      expect(html2canvasMock).toHaveBeenCalledWith(
        element,
        expect.objectContaining({
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
        }),
      );

      expect(addImageMock).toHaveBeenCalled();
      expect(saveMock).toHaveBeenCalledWith("test.pdf");
    });

    it("should wrap renderer errors with PDF generation message", async () => {
      const element = { innerHTML: "<div>Data</div>" };

      html2canvasMock.mockRejectedValue(new Error("renderer failed"));

      await expect(exportElementToPdf(element, "test.pdf")).rejects.toThrow(
        "Failed to generate PDF: renderer failed",
      );
    });
  });
});
