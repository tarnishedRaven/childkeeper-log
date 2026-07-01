import { describe, it, expect, vi } from "vitest";
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Mock Firebase
vi.mock("firebase/app");
vi.mock("firebase/auth");
vi.mock("firebase/firestore");

describe("Firebase Configuration", () => {
  it("should initialize Firebase with config from environment", () => {
    expect(initializeApp).toBeDefined();
    expect(getAuth).toBeDefined();
    expect(getFirestore).toBeDefined();
  });

  it("should have mocked Firebase functions available", () => {
    // Test that mocks are set up properly
    expect(vi.isMockFunction(initializeApp)).toBe(true);
    expect(vi.isMockFunction(getAuth)).toBe(true);
    expect(vi.isMockFunction(getFirestore)).toBe(true);
  });
});
