const GALLERY_JSON_URL = 'https://raw.githubusercontent.com/thmsgo18/latex-forge-gallery/main/gallery.json';

export interface GalleryTemplate {
    name: string;
    description: string;
    category: string;
    source_url: string;
    install_url: string;
    tags: string[];
    engine: string;
    preview_png?: string;
    preview_pdf?: string;
}

/**
 * Fetches the curated template list from the latex-forge-gallery repository.
 * This is the only network call the extension makes; everything else runs
 * through the local `latex-forge` CLI.
 */
export async function fetchGalleryTemplates(): Promise<GalleryTemplate[]> {
    const response = await fetch(GALLERY_JSON_URL);
    if (!response.ok) {
        throw new Error(`Failed to fetch the template gallery (HTTP ${response.status} ${response.statusText}).`);
    }

    const data = (await response.json()) as { templates?: unknown };
    if (!Array.isArray(data.templates)) {
        throw new Error('Unexpected gallery format: expected a "templates" array.');
    }

    return data.templates as GalleryTemplate[];
}
