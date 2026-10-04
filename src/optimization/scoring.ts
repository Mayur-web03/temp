import type { ResupplyOption } from "@/types/domain";

export function optionScore(option: ResupplyOption) {
  if (option.kind === "pre_position") return option.deliveryConfidence * 0.15;
  const speed = 1 / (1 + option.meanDays);
  const lastMile = option.kind === "helicopter" || option.kind === "cross_level" || option.kind === "split_shipment" ? 0.12 : 0;
  return (
    option.deliveryConfidence * 0.5 +
    (1 - option.stockoutIfChosen) * 0.2 +
    speed * 0.16 +
    (1 - option.cost) * 0.1 +
    lastMile
  );
}

export function rankOptions(options: ResupplyOption[]) {
  return [...options].sort((a, b) => optionScore(b) - optionScore(a));
}
