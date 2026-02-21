/**
 * Generate a full color shade palette (50–950) from a single hex color.
 * Used by the white-label system to derive an entire primary palette
 * from the school's `branding.primaryColor` in config.json.
 *
 * Algorithm: converts hex → HSL, then creates lighter/darker variants
 * by adjusting lightness while preserving hue and saturation.
 */

type ColorPalette = {
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;
    600: string;
    700: string;
    800: string;
    900: string;
    950: string;
    main: string;
};

// Convert hex to HSL
function hexToHSL(hex: string): [number, number, number] {
    hex = hex.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }

    return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

// Convert HSL to hex
function hslToHex(h: number, s: number, l: number): string {
    s /= 100;
    l /= 100;

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;

    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else { r = c; b = x; }

    const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * Generate a full shade palette from a single brand color.
 * The input color is used as the 600 shade (main brand color),
 * and lighter/darker variants are derived from it.
 */
export function generatePalette(hex: string): ColorPalette {
    const [h, s] = hexToHSL(hex);

    // Shade → target lightness mapping (600 = the input color)
    const shades: Record<string, number> = {
        50: 96,
        100: 90,
        200: 82,
        300: 72,
        400: 58,
        500: 48,
        600: 40,  // main brand
        700: 33,
        800: 26,
        900: 20,
        950: 14,
    };

    const palette: any = {};
    for (const [shade, lightness] of Object.entries(shades)) {
        // Slightly desaturate at extremes for natural look
        const satAdjust = shade === '50' || shade === '100' ? Math.max(s - 15, 20) :
            shade === '900' || shade === '950' ? Math.max(s - 10, 25) : s;
        palette[parseInt(shade)] = hslToHex(h, satAdjust, lightness);
    }

    palette.main = hex;

    return palette as ColorPalette;
}
