import { MetadataRoute } from "next";
import scheduleData from "@/data/schedule.json";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://xn--989ar05c.kro.kr",
      lastModified: new Date(scheduleData.lastUpdated),
      changeFrequency: "daily",
      priority: 1,
    },
  ];
}
