import { readFileSync } from "node:fs";
import { join } from "node:path";
import { root } from "./lib/seed-constants.mjs";

const data = JSON.parse(
  readFileSync(join(root, "seed", "data", "staff-services-glossgenius.json"), "utf8"),
);

function esc(value) {
  return value.replace(/'/g, "''");
}

for (const staff of data.staff) {
  const values = staff.services.map(
    (svc) => `('${staff.staff_id}', '${esc(svc.name)}')`,
  );
  const sql = `INSERT INTO staff_services (staff_id, service_id)
SELECT DISTINCT ON (v.staff_id, upper(trim(v.service_name)))
  v.staff_id::uuid,
  s.id
FROM (VALUES
${values.join(",\n")}
) AS v(staff_id, service_name)
JOIN services s ON upper(trim(s.name)) = upper(trim(v.service_name))
ORDER BY v.staff_id, upper(trim(v.service_name)), s.id;`;
  console.log(`-- ${staff.staff_name} (${values.length})`);
  console.log(sql);
  console.log("");
}
