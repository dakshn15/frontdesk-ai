import { describe, expect, it } from "vitest";
import { z } from "zod";
import { serviceInputSchema } from "@/features/services/schemas";

const schema = serviceInputSchema("USD");

describe("serviceInputSchema", () => {
  it("turns form values into a service", () => {
    expect(
      schema.parse({
        name: " Balayage ",
        durationMinutes: "180",
        bufferMinutes: "15",
        price: "180",
        priceIsFrom: "on",
        bookableOnline: "on",
      }),
    ).toEqual({
      name: "Balayage",
      description: "",
      category: "",
      durationMinutes: 180,
      bufferMinutes: 15,
      priceCents: 18000,
      priceIsFrom: true,
      bookableOnline: true,
    });
  });

  it("treats an unticked checkbox as off and a blank price as none", () => {
    const service = schema.parse({
      name: "Trim",
      durationMinutes: "30",
      bufferMinutes: "0",
      price: "",
    });
    expect(service.bookableOnline).toBe(false);
    expect(service.priceIsFrom).toBe(false);
    expect(service.priceCents).toBeNull();
  });

  it("explains invalid values", () => {
    const result = schema.safeParse({
      name: "T",
      durationMinutes: "7",
      bufferMinutes: "300",
      price: "45.505",
    });
    expect(z.flattenError(result.error!).fieldErrors).toEqual({
      name: ["Use 2 to 80 characters."],
      durationMinutes: ["Use 5 to 720 minutes, in steps of 5."],
      bufferMinutes: ["Use 0 to 240 minutes, in steps of 5."],
      price: ["Enter a price like 45 or 45.50."],
    });
  });
});
