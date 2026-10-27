import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mitsu — your little reading corner",
    short_name: "Mitsu",
    description:
      "A calm, local-first manga library and reader. Your files stay on your machine.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#fbf7f4",
    theme_color: "#fbf7f4",
    categories: ["books", "entertainment", "lifestyle"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Library",
        url: "/library",
        description: "Browse your shelves",
      },
      {
        name: "Continue reading",
        url: "/history",
        description: "Jump back into a gallery",
      },
      {
        name: "Import",
        url: "/imports",
        description: "Bring in a new gallery",
      },
    ],
  };
}
