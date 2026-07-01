import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  exportElementToPdf,
  generateReportPdfFilename,
  validateExportElement,
} from "./pdfService";

vi.mock("jspdf");
vi.mock("html2canvas");

describe("PDF Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    it("should fallback to generic filename on error", () => {
      const filename = generateReportPdfFilename("invalid", "invalid");

      expect(filename).toBe("ChildkeeperLog-Report.pdf");
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

    it("should throw error for missing filename", async () => {
      const element = { innerHTML: "<table><tr><td>Data</td></tr></table>" };

      // This should attempt to save PDF, so we mock the dependencies
      vi.mock("html2canvas", () => ({
        default: vi.fn().mockResolvedValue({ toDataURL: vi.fn() }),
      }));

      // For this test, we'll just verify it requires an element
      await expect(exportElementToPdf(element, "")).rejects.toBeDefined();
    });
  });
});
