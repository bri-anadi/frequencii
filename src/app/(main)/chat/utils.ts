import { z } from "zod";

export const contactSchema = z.string().min(32, "Address is too short").max(44, "Address is too long");
export const giftSchema = z.string().regex(/^\d+(\.\d+)?$/, "Invalid amount").refine(val => Number(val) > 0, "Amount must be greater than 0");

export const formatContactName = (name: string) => {
    if (name.length > 16) {
        return `${name.slice(0, 6)}...${name.slice(-4)}`;
    }
    return name;
};
