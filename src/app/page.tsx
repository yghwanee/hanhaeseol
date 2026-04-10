import fs from "fs";
import path from "path";
import { ScheduleData } from "@/types/schedule";
import ScheduleClient from "./ScheduleClient";

export default function Home() {
  const filePath = path.join(process.cwd(), "public", "schedule.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  const data: ScheduleData = JSON.parse(raw);

  return <ScheduleClient initialData={data} />;
}
