import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://xn--989ar05c.kro.kr",
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
  ];
}
