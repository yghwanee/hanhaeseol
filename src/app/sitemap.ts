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
    {
      url: "https://xn--989ar05c.kro.kr/about",
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: "https://xn--989ar05c.kro.kr/privacy",
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: "https://xn--989ar05c.kro.kr/terms",
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
