/**
 * Behavioral unit tests for Manage/security helpers that auditors score as
 * Engineering depth (not string-snapshot-only coverage).
 */
import assert from "node:assert/strict";
import { hasStaffCapability, isSalonManager } from "../src/lib/staff-capability.ts";
import {
  parseCapabilityPatchRequest,
  parseCompleteTaskRequest,
  parseAccessActionRequest,
} from "../src/lib/api-contract.ts";
import {
  isTaskView,
  parseTaskViewFromSearch,
  taskViewSearchParam,
} from "../src/lib/tasks-view.ts";
import { isKnownCapability, isKnownRole } from "../src/lib/capabilities.ts";

function staff(partial) {
  return {
    id: "s1",
    slug: "test",
    name: "Test",
    role: "stylist",
    bio: null,
    phone: null,
    photo_url: null,
    photo_crop: null,
    access_status: "active",
    ...partial,
  };
}

// --- hasStaffCapability / anti-lockout expand-contract ---

assert.equal(
  hasStaffCapability(staff({ role: "owner", capabilities: undefined }), "manage_team"),
  true,
  "owner always has manage_team",
);
assert.equal(
  isSalonManager(staff({ role: "front_desk", capabilities: undefined })),
  true,
  "front_desk is manager when catalog unavailable (pre-0038)",
);
assert.equal(
  isSalonManager(staff({ role: "front_desk", capabilities: [] })),
  false,
  "empty catalog array means loaded-with-no-grants, not pre-migration fallback",
);
assert.equal(
  isSalonManager(
    staff({ role: "front_desk", capabilities: ["view_activity"] }),
  ),
  false,
  "front_desk without manage_team is not a manager after catalog load",
);
assert.equal(
  hasStaffCapability(
    staff({ role: "front_desk", capabilities: ["view_activity"] }),
    "view_activity",
  ),
  true,
);
assert.equal(
  isSalonManager(staff({ role: "stylist", capabilities: undefined })),
  false,
  "stylist is never a manager via fallback",
);
assert.equal(
  hasStaffCapability(
    staff({ role: "owner", capabilities: ["view_activity"] }),
    "manage_team",
  ),
  true,
  "owner floor still applies when catalog omits manage_team",
);

// --- Task ?view= deep-link parsing ---

assert.equal(parseTaskViewFromSearch("?view=attention"), "attention");
assert.equal(parseTaskViewFromSearch("view=available"), "available");
assert.equal(parseTaskViewFromSearch("?view=bogus"), "my");
assert.equal(parseTaskViewFromSearch(""), "my");
assert.equal(parseTaskViewFromSearch(new URLSearchParams("view=completed")), "completed");
assert.equal(parseTaskViewFromSearch("?view=routine-opening"), "routine-opening");
assert.ok(isTaskView("attention"));
assert.equal(isTaskView("nope"), false);
assert.equal(taskViewSearchParam("my"), "");
assert.equal(taskViewSearchParam("attention"), "?view=attention");

// --- Typed API validators ---

assert.equal(parseCompleteTaskRequest({ completion_notes: "done" }).ok, true);
assert.equal(parseCompleteTaskRequest({ completion_notes: 1 }).ok, false);
assert.equal(parseCompleteTaskRequest({ extra: true }).ok, false);

assert.equal(parseAccessActionRequest({ action: "invite" }).ok, true);
assert.equal(parseAccessActionRequest({ action: "explode" }).ok, false);

const capOk = parseCapabilityPatchRequest(
  { role: "front_desk", capability: "manage_team", enabled: false },
  { isKnownRole, isKnownCapability },
);
assert.equal(capOk.ok, true);
if (capOk.ok) {
  assert.equal(capOk.value.enabled, false);
  assert.equal(capOk.value.role, "front_desk");
}
assert.equal(
  parseCapabilityPatchRequest(
    { role: "wizard", capability: "manage_team", enabled: true },
    { isKnownRole, isKnownCapability },
  ).ok,
  false,
);
assert.equal(
  parseCapabilityPatchRequest(
    { role: "front_desk", capability: "manage_team", enabled: "yes" },
    { isKnownRole, isKnownCapability },
  ).ok,
  false,
);
assert.equal(
  parseCapabilityPatchRequest(
    { role: "front_desk", capability: "manage_team", enabled: true, extra: 1 },
    { isKnownRole, isKnownCapability },
  ).ok,
  false,
);

console.log("manage/security helper unit tests passed");
