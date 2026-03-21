/**
 * Capitalizes the first letter of each word in a string
 * Example: "chocolate chip cookies" -> "Chocolate Chip Cookies"
 */
export function capitalizeWords(text: string): string {
  if (!text) return text;
  
  return text
    .split(' ')
    .map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    )
    .join(' ');
}

/**
 * Capitalizes only the first letter of the entire string
 * Example: "chocolate chip cookies" -> "Chocolate chip cookies"
 */
export function capitalizeFirst(text: string): string {
  if (!text) return text;
  
  return text.charAt(0).toUpperCase() + text.slice(1);
}
