/**
 * Unicode Braille Spinners
 *
 * A collection of animated unicode spinners built on braille characters (U+2800 block).
 * Each braille char is a 2×4 dot grid — these generators compose them into
 * multi-character animated frames for use as loading indicators.
 */
interface Spinner {
    readonly frames: readonly string[];
    readonly interval: number;
}
type BrailleSpinnerName = 'braille' | 'braillewave' | 'dna' | 'scan' | 'rain' | 'scanline' | 'pulse' | 'snake' | 'sparkle' | 'cascade' | 'columns' | 'orbit' | 'breathe' | 'waverows' | 'checkerboard' | 'helix' | 'fillsweep' | 'diagswipe';
/**
 * Convert a 2D boolean grid into a braille string.
 * grid[row][col] = true means dot is raised.
 * Width must be even (2 dot-columns per braille char).
 */
declare function gridToBraille(grid: boolean[][]): string;
/** Create an empty grid of given dimensions */
declare function makeGrid(rows: number, cols: number): boolean[][];
declare const spinners: Record<BrailleSpinnerName, Spinner>;

export { type BrailleSpinnerName, type Spinner, spinners as default, gridToBraille, makeGrid, spinners };
