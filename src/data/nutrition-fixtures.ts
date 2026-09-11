import type { Meal } from "@/lib/nutrition/daily";

// Illustrative UI fixtures only. Not nutrition advice or the user's food records.
export function sampleMeals(day: string, days: string[]): Meal[] {
  const index = days.indexOf(day);
  if (index < 0 || index === 2) return [];
  const meals: Meal[] = [
    { id: day + "-breakfast", type: "Breakfast", time: "08:30", items: [
      { name: "Oats with yogurt", portion: "1 bowl", calories: 310, protein: 18, carbs: 42, fat: 8 },
      { name: "Banana", portion: "1 piece", calories: 105, protein: 1.3, carbs: 27, fat: 0.4 },
    ] },
    { id: day + "-lunch", type: "Lunch", time: "13:00", items: [
      { name: "Rice", portion: "1 bowl", calories: 260, protein: 5, carbs: 56, fat: 0.6 },
      { name: "Dal", portion: "1 bowl", calories: 220, protein: 13, carbs: 30, fat: 6 },
      { name: "Mixed vegetables", portion: "1 serving", calories: 90, protein: 3, carbs: 12, fat: 3 },
    ] },
    { id: day + "-snack", type: "Snack", time: "16:00", items: [
      { name: "Roasted chickpeas", portion: "1 small bowl", calories: 160, protein: 8, carbs: 24, fat: 3 },
    ] },
  ];
  if (index > 0) meals.push({ id: day + "-dinner", type: "Dinner", time: "20:00", items: [
    { name: "Paneer with vegetables", portion: "1 serving", calories: 350, protein: 24, carbs: 14, fat: 22 },
    { name: "Roti", portion: "2 pieces", calories: 200, protein: 6, carbs: 40, fat: 2 },
  ] });
  if (index === 3) meals.push({ id: day + "-other", type: "Other", time: "21:00", items: [
    { name: "Milk", portion: "1 glass", calories: 120, protein: 8, carbs: 12, fat: 4 },
  ] });
  return meals;
}
