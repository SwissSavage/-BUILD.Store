import assert from "node:assert/strict";
import test from "node:test";
import { formatProposalHours, formatProposalPrice, parseContractProposalTerms } from "./proposal-terms";
import { aggregateHeadline, deriveAggregatePricing, pricingHeadline } from "./quote-pricing";
import type { ProposedBuilder } from "./types";

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

test("contributor minimums, optional maximums, and legacy exact values", () => {
  const bounds = { minRate: 20, maxRate: 2000 };
  const hourly = parseContractProposalTerms(form({
    priceMode: "hourly", hourlyRate: "25", hoursPerWeek: "20",
  }), bounds);
  assert.equal(formatProposalPrice(hourly), "From $25/hr");
  assert.equal(formatProposalHours(hourly.hoursPerWeek, hourly.hoursPerWeekMax), "At least 20 hrs/week");

  const fixed = parseContractProposalTerms(form({
    priceMode: "fixed", fixedPriceMin: "5000", fixedPriceMax: "7500",
    hoursPerWeek: "20", hoursPerWeekMax: "30",
  }), bounds);
  assert.equal(formatProposalPrice(fixed), "$5,000–$7,500 total");
  assert.equal(formatProposalHours(fixed.hoursPerWeek, fixed.hoursPerWeekMax), "20–30 hrs/week");
  assert.equal(formatProposalPrice({ hourlyRate: "25", hourlyRateMax: "25" }), "$25/hr");
  assert.throws(() => parseContractProposalTerms(form({
    priceMode: "fixed", fixedPriceMin: "100", fixedPriceMax: "90", hoursPerWeek: "20",
  }), bounds), /Maximum price/);
  assert.throws(() => parseContractProposalTerms(form({
    priceMode: "negotiable", hoursPerWeek: "30", hoursPerWeekMax: "20",
  }), bounds), /Maximum hours/);
});

test("client quote keeps ranges and negotiable bids distinct from exact prices", () => {
  const split = { talentSplit: 85, operationsSplit: 15 };
  const builders: ProposedBuilder[] = [
    { userId: "one", timeline: "20 hours", relevance: "Relevant work", pricing: { type: "fixed", baseAmount: 5000, minimumOnly: true, ...split } },
    { userId: "two", timeline: "20 hours", relevance: "Relevant work", pricing: { type: "hourly", hourlyRate: 25, hourlyRateMax: 35, ...split } },
    { userId: "three", timeline: "20 hours", relevance: "Relevant work", pricing: { type: "negotiable", ...split } },
  ];
  assert.equal(pricingHeadline(builders[1].pricing), "$25–$35/hr");
  assert.equal(aggregateHeadline(deriveAggregatePricing(builders)), "From $5,000 total plus $25–$35/hr plus 1 price to be agreed");
});
