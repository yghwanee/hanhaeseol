import { MetadataRoute } from "next";
import scheduleData from "@/data/schedule.json";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://haeseol.com",
      lastModified: new Date(scheduleData.lastUpdated),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: "https://haeseol.com/analysis",
      lastModified: new Date(scheduleData.lastUpdated),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: "https://haeseol.com/about",
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: "https://haeseol.com/privacy",
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: "https://haeseol.com/terms",
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
