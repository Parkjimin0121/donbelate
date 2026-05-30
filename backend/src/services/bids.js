export function removeBidOutliers(amounts) {
  const sorted = [...amounts].sort((a, b) => a - b);
  if (sorted.length < 5) return sorted;
  return sorted.slice(1, -1);
}

export function splitQuartiles(amounts) {
  const sorted = [...amounts].sort((a, b) => a - b);
  const quartiles = [[], [], [], []];

  sorted.forEach((amount, index) => {
    const quartileIndex = Math.min(3, Math.floor((index * 4) / sorted.length));
    quartiles[quartileIndex].push(amount);
  });

  return quartiles.map((values, index) => ({
    index: index + 1,
    values,
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null,
    average: values.length
      ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
      : null
  }));
}

export function drawLateFee(amounts) {
  const filteredAmounts = removeBidOutliers(amounts);
  const quartiles = splitQuartiles(filteredAmounts);
  const available = quartiles.filter((quartile) => quartile.values.length > 0);
  const selected = available[Math.floor(Math.random() * available.length)];

  return {
    originalAmounts: amounts,
    filteredAmounts,
    quartiles,
    selectedQuartile: selected.index,
    finalLateFeePerMinute: selected.average
  };
}
