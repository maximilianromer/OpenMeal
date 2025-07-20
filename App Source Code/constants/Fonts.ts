/**
 * TikTok Sans font family mapping utility
 * Maps font weights to appropriate TikTok Sans font families
 */

export const TikTokSansFonts = {
  light: 'TikTokSans-Light',
  regular: 'TikTokSans-Regular',
  medium: 'TikTokSans-Medium',
  semiBold: 'TikTokSans-SemiBold',
  bold: 'TikTokSans-Bold',
  extraBold: 'TikTokSans-ExtraBold',
  black: 'TikTokSans-Black',
} as const;

/**
 * Get TikTok Sans font family based on font weight
 * @param fontWeight - The font weight (string or number)
 * @returns The appropriate TikTok Sans font family
 */
export function getTikTokSansFont(fontWeight?: string | number): string {
  if (typeof fontWeight === 'string') {
    switch (fontWeight) {
      case 'light':
      case '300':
        return TikTokSansFonts.light;
      case 'normal':
      case 'regular':
      case '400':
        return TikTokSansFonts.regular;
      case 'medium':
      case '500':
        return TikTokSansFonts.medium;
      case 'semibold':
      case '600':
        return TikTokSansFonts.semiBold;
      case 'bold':
      case '700':
        return TikTokSansFonts.bold;
      case 'extrabold':
      case '800':
        return TikTokSansFonts.extraBold;
      case 'black':
      case '900':
        return TikTokSansFonts.black;
      default:
        return TikTokSansFonts.regular;
    }
  } else if (typeof fontWeight === 'number') {
    if (fontWeight <= 300) return TikTokSansFonts.light;
    if (fontWeight <= 400) return TikTokSansFonts.regular;
    if (fontWeight <= 500) return TikTokSansFonts.medium;
    if (fontWeight <= 600) return TikTokSansFonts.semiBold;
    if (fontWeight <= 700) return TikTokSansFonts.bold;
    if (fontWeight <= 800) return TikTokSansFonts.extraBold;
    return TikTokSansFonts.black;
  }
  
  return TikTokSansFonts.regular;
}

/**
 * Create a style object with TikTok Sans font family
 * @param fontWeight - The desired font weight
 * @returns Style object with fontFamily (and removes fontWeight to avoid conflicts)
 */
export function createTikTokSansStyle(fontWeight?: string | number) {
  return {
    fontFamily: getTikTokSansFont(fontWeight),
  };
} 