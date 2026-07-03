-- Salon Citrine seed data (generated — do not edit by hand)
-- Regenerate: npm run db:generate-seed

begin;

truncate table public.appointment_services, public.appointments, public.clients,
  public.blocked_times, public.staff_schedules, public.staff_services,
  public.services, public.staff, public.policies restart identity cascade;

-- staff
insert into public.staff (id, slug, name, role, bio, photo_url, glossgenius_token, is_bookable) values ('a1000001-0001-4000-8000-000000000001', 'lily-gleitsman', 'Lily Gleitsman', 'owner', null, '/images/lily-gleitsman.jpg', '10001-f5bd9a7b-3e2f-4255-951d-ca4881f88678', true);
insert into public.staff (id, slug, name, role, bio, photo_url, glossgenius_token, is_bookable) values ('a1000001-0001-4000-8000-000000000002', 'miriam-zhukov', 'Miriam Zhukov', 'owner', null, '/images/miriam-zhukov.jpg', '10001-690e87a4-3d1b-44db-a449-08c9d40b5dff', true);
insert into public.staff (id, slug, name, role, bio, photo_url, glossgenius_token, is_bookable) values ('a1000001-0001-4000-8000-000000000003', 'andra-kramer', 'Andra Kramer', 'owner', null, '/images/andra-kramer.jpg', '10001-7e4b7dd5-f741-4f6f-b71d-ed5cc3b638ec', true);
insert into public.staff (id, slug, name, role, bio, photo_url, glossgenius_token, is_bookable) values ('a1000001-0001-4000-8000-000000000004', 'shelby-craft', 'Shelby Craft', 'stylist', 'Specializes in alternative, vivid, edgy styles and low-maintenance natural looks', '/images/shelby-craft.jpg', '10001-6a29adda-3651-43d9-8899-3ace37524a1e', true);
insert into public.staff (id, slug, name, role, bio, photo_url, glossgenius_token, is_bookable) values ('a1000001-0001-4000-8000-000000000005', 'jules-hoffman', 'Jules Hoffman', 'stylist', 'Helping you feel like the star you are, one appointment at a time.', '/images/jules-hoffman.jpg', '10001-40fac3c0-b13b-47c2-86da-6e1c3452329f', true);
insert into public.staff (id, slug, name, role, bio, photo_url, glossgenius_token, is_bookable) values ('a1000001-0001-4000-8000-000000000006', 'brie-crowe', 'Brie Crowe', 'stylist', null, '/images/brie-crowe.jpg', '10001-32abe5c0-3025-48ed-8516-850b1fc5783f', true);
insert into public.staff (id, slug, name, role, bio, photo_url, glossgenius_token, is_bookable) values ('a1000001-0001-4000-8000-000000000007', 'julie-powers', 'Julie Powers', 'esthetician', 'Korean-inspired facials, peels, waxing, and makeup artistry', '/images/julie-powers.jpg', '10001-d788dd27-3f49-452f-af8e-c87bb31e94c3', true);

-- staff_schedules (salon business hours for all bookable staff)
insert into public.staff_schedules (staff_id, day_of_week, start_time, end_time) values ('a1000001-0001-4000-8000-000000000001', 2, '10:00', '20:00');
insert into public.staff_schedules (staff_id, day_of_week, start_time, end_time) values ('a1000001-0001-4000-8000-000000000001', 3, '10:00', '20:00');
insert into public.staff_schedules (staff_id, day_of_week, start_time, end_time) values ('a1000001-0001-4000-8000-000000000001', 4, '10:00', '20:00');
insert into public.staff_schedules (staff_id, day_of_week, start_time, end_time) values ('a1000001-0001-4000-8000-000000000001', 5, '10:00', '17:00');
insert into public.staff_schedules (staff_id, day_of_week, start_time, end_time) values ('a1000001-0001-4000-8000-000000000001', 6, '10:00', '17:00');
insert into public.staff_schedules (staff_id, day_of_week, start_time, end_time) values ('a1000001-0001-4000-8000-000000000002', 2, '10:00', '20:00');
insert into public.staff_schedules (staff_id, day_of_week, start_time, end_time) values ('a1000001-0001-4000-8000-000000000002', 3, '10:00', '20:00');
insert into public.staff_schedules (staff_id, day_of_week, start_time, end_time) values ('a1000001-0001-4000-8000-000000000002', 4, '10:00', '20:00');
insert into public.staff_schedules (staff_id, day_of_week, start_time, end_time) values ('a1000001-0001-4000-8000-000000000002', 5, '10:00', '17:00');
insert into public.staff_schedules (staff_id, day_of_week, start_time, end_time) values ('a1000001-0001-4000-8000-000000000002', 6, '10:00', '17:00');
insert into public.staff_schedules (staff_id, day_of_week, start_time, end_time) values ('a1000001-0001-4000-8000-000000000003', 2, '10:00', '20:00');
insert into public.staff_schedules (staff_id, day_of_week, start_time, end_time) values ('a1000001-0001-4000-8000-000000000003', 3, '10:00', '20:00');
insert into public.staff_schedules (staff_id, day_of_week, start_time, end_time) values ('a1000001-0001-4000-8000-000000000003', 4, '10:00', '20:00');
insert into public.staff_schedules (staff_id, day_of_week, start_time, end_time) values ('a1000001-0001-4000-8000-000000000003', 5, '10:00', '17:00');
insert into public.staff_schedules (staff_id, day_of_week, start_time, end_time) values ('a1000001-0001-4000-8000-000000000003', 6, '10:00', '17:00');
insert into public.staff_schedules (staff_id, day_of_week, start_time, end_time) values ('a1000001-0001-4000-8000-000000000004', 2, '10:00', '20:00');
insert into public.staff_schedules (staff_id, day_of_week, start_time, end_time) values ('a1000001-0001-4000-8000-000000000004', 3, '10:00', '20:00');
insert into public.staff_schedules (staff_id, day_of_week, start_time, end_time) values ('a1000001-0001-4000-8000-000000000004', 4, '10:00', '20:00');
insert into public.staff_schedules (staff_id, day_of_week, start_time, end_time) values ('a1000001-0001-4000-8000-000000000004', 5, '10:00', '17:00');
insert into public.staff_schedules (staff_id, day_of_week, start_time, end_time) values ('a1000001-0001-4000-8000-000000000004', 6, '10:00', '17:00');
insert into public.staff_schedules (staff_id, day_of_week, start_time, end_time) values ('a1000001-0001-4000-8000-000000000005', 2, '10:00', '20:00');
insert into public.staff_schedules (staff_id, day_of_week, start_time, end_time) values ('a1000001-0001-4000-8000-000000000005', 3, '10:00', '20:00');
insert into public.staff_schedules (staff_id, day_of_week, start_time, end_time) values ('a1000001-0001-4000-8000-000000000005', 4, '10:00', '20:00');
insert into public.staff_schedules (staff_id, day_of_week, start_time, end_time) values ('a1000001-0001-4000-8000-000000000005', 5, '10:00', '17:00');
insert into public.staff_schedules (staff_id, day_of_week, start_time, end_time) values ('a1000001-0001-4000-8000-000000000005', 6, '10:00', '17:00');
insert into public.staff_schedules (staff_id, day_of_week, start_time, end_time) values ('a1000001-0001-4000-8000-000000000006', 2, '10:00', '20:00');
insert into public.staff_schedules (staff_id, day_of_week, start_time, end_time) values ('a1000001-0001-4000-8000-000000000006', 3, '10:00', '20:00');
insert into public.staff_schedules (staff_id, day_of_week, start_time, end_time) values ('a1000001-0001-4000-8000-000000000006', 4, '10:00', '20:00');
insert into public.staff_schedules (staff_id, day_of_week, start_time, end_time) values ('a1000001-0001-4000-8000-000000000006', 5, '10:00', '17:00');
insert into public.staff_schedules (staff_id, day_of_week, start_time, end_time) values ('a1000001-0001-4000-8000-000000000006', 6, '10:00', '17:00');
insert into public.staff_schedules (staff_id, day_of_week, start_time, end_time) values ('a1000001-0001-4000-8000-000000000007', 2, '10:00', '20:00');
insert into public.staff_schedules (staff_id, day_of_week, start_time, end_time) values ('a1000001-0001-4000-8000-000000000007', 3, '10:00', '20:00');
insert into public.staff_schedules (staff_id, day_of_week, start_time, end_time) values ('a1000001-0001-4000-8000-000000000007', 4, '10:00', '20:00');
insert into public.staff_schedules (staff_id, day_of_week, start_time, end_time) values ('a1000001-0001-4000-8000-000000000007', 5, '10:00', '17:00');
insert into public.staff_schedules (staff_id, day_of_week, start_time, end_time) values ('a1000001-0001-4000-8000-000000000007', 6, '10:00', '17:00');

-- policies
insert into public.policies (slug, title, body, sort_order) values ('cancellation', 'Cancellation Policy', 'Reschedule 48+ hours before your appointment to avoid a fee. Cancel within 48 hours: 50% charge. No-show: 100% charge. Arriving 15+ minutes late without contact counts as a no-show. Fees are waived if you reschedule within the same week. A card on file is required to secure your booking.', 1);
insert into public.policies (slug, title, body, sort_order) values ('consultation', 'Consultation Policy', 'All full service appointments include a consultation. Color consultations are required before big transformations. Consultation fees apply toward your first full service when booked.', 2);
insert into public.policies (slug, title, body, sort_order) values ('pricing', 'Pricing Policy', 'Prices with a + are starting rates and may vary based on hair length, density, and stylist level. See the full service menu when booking online.', 3);
insert into public.policies (slug, title, body, sort_order) values ('booking', 'Booking Policy', 'Appointments are booked through the online scheduling system. A card on file may be required to secure your booking.', 4);

-- services
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-4300-4000-8000-0000000200000001', 'Haircuts', 'NEW CLIENT HAIRCUT', 'First time at Salon Citrine? Welcome! This is the service for you, as it gives your stylist more time to consult & familiarize themselves with your hair. Shampoo & blowout included.', 5500, 60, true, false, false, 1);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-4300-4000-8000-0000000300000001', 'Haircuts', 'HAIRCUT', 'For returning clients only! Your classic haircut to maintain your current shape. Shampoo & blowout included.
*Not for new shapes requiring more than 4+ inches off*', 5500, 60, true, false, false, 2);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-4300-4000-8000-0000000400000001', 'Haircuts', 'TRANSFORMATIVE HAIRCUT', 'Intended for big changes such as taking more than 3" off and creating new shape. *GREAT for a  new Shag / Mullet / Bob or Pixie*', 6500, 60, true, false, false, 3);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-4300-4000-8000-0000000500000001', 'Haircuts', 'CLIPPER CUT', 'Maintaining your personalized tapered look, typically with clippers, but not limited to.
Shampoo & style included.', 4500, 60, true, false, false, 4);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-4300-4000-8000-0000000600000001', 'Haircuts', 'DRY CUT', 'Maintenance haircut with no shampoo, style, or product.  Come in with clean, dry hair down.', 6000, 60, true, false, false, 5);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-4300-4000-8000-0000000700000001', 'Haircuts', 'FRINGE / UNDERCUT MAINTENANCE', 'This is the ideal freshen up between haircuts. *Good for Bang trims, undercut trims, & neckline cleanups*', 3000, 30, true, false, false, 6);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-4300-4000-8000-0000000800000001', 'Haircuts', 'BABY''S FIRST HAIRCUT', 'Is it time to get rid of the baby mullet, or simply get it out of their eyes? We''re here for you. For 0-2 year olds.', 2000, 60, true, false, false, 7);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-4300-4000-8000-0000000900000001', 'Haircuts', 'LITTLE KID''S HAIRCUT', '2-5 year olds. *No shampoo experience included.', 3500, 60, true, false, false, 8);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-4300-4000-8000-0000000a00000001', 'Haircuts', 'BIG KID''S HAIRCUT', '6-11 year olds, shampoo experience included if they want!', 4500, 60, true, false, false, 9);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-4300-4000-8000-0000000b00000001', 'Haircuts', 'DETANGLE', 'Need some help getting through mats or stubborn tangles, we got you!', 6500, 60, true, false, false, 10);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-de00-4000-8000-0000000c00000001', 'Color- Dimensional Color', 'FULL DIMENSIONAL COLOR & BLOWOUT', 'Full head of dimensional color. Plus a blowout! 

*Good for highlights/lowlights/balayage*', 15000, 120, true, false, false, 11);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-de00-4000-8000-0000000d00000001', 'Color- Dimensional Color', 'FULL DIMENSIONAL COLOR & CUT', 'Full head of dimensional color. Plus a custom haircut! 

*Good for highlights/lowlights/balayage*', 20000, 120, true, false, false, 12);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-de00-4000-8000-0000000e00000001', 'Color- Dimensional Color', 'PARTIAL DIMENSIONAL COLOR & BLOWOUT', 'Intended to freshen up existing dimensional hair. Plus a blowout.

*Good for highlights/balayage*', 9000, 120, true, false, false, 13);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-de00-4000-8000-0000000f00000001', 'Color- Dimensional Color', 'PARTIAL DIMENSIONAL COLOR & CUT', 'Intended to freshen up existing dimensional hair.  Plus a custom haircut. 

*Good for highlights/balayage*', 14000, 120, true, false, false, 14);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-de00-4000-8000-0000001000000001', 'Color- Dimensional Color', 'MINI LIGHTS & BLOWOUT', 'Intended to brighten around the face or along the part. Plus a blowout.
*Good for face framing highlights/money piece, or color blocking*', 8000, 120, true, false, false, 15);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-de00-4000-8000-0000001100000001', 'Color- Dimensional Color', 'MINI LIGHTS & CUT', 'Intended to brighten around the face or along the part. Plus a custom Haircut.
*Good for face framing highlights/ "Money piece"*', 13000, 120, true, false, false, 16);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-8700-4000-8000-0000001200000001', 'Color- Bleach & Tone', 'ALL OVER BLEACH AND TONE & BLOWOUT', 'Solid blonde look, achieved by lightening from scalp to ends and toning to desired tone. Plus a blowout!', 30000, 120, true, false, false, 17);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-8700-4000-8000-0000001300000001', 'Color- Bleach & Tone', 'ALL OVER BLEACH AND TONE & HAIRCUT', 'Solid blonde look, achieved by lightening from scalp to ends and toning to desired tone. Plus a custom haircut!', 37500, 120, true, false, false, 18);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-8700-4000-8000-0000001400000001', 'Color- Bleach & Tone', 'BLEACH ROOT TOUCH UP & BLOWOUT', 'Intended to touch up the roots from previous bleach and toned hair. Plus a blowout!

*ONLY for roots 1" or under. If longer, book an All Over Bleach & Tone*', 15000, 120, true, false, false, 19);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-8700-4000-8000-0000001500000001', 'Color- Bleach & Tone', 'BLEACH ROOT TOUCH UP & HAIRCUT', 'Intended to touch up the roots from previous bleach and toned hair. Plus a custom haircut!  

*ONLY for roots 1" or under. If longer, book an All Over Bleach & Tone*', 22500, 120, true, false, false, 20);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-5200-4000-8000-0000001600000001', 'Color- Single Color & Root Touch Ups', 'ALL OVER COLOR WITH BLOWOUT', 'One solid color from scalp to ends, typically darker. *NOT for dimensional color or going lighter* Plus a blowout!', 10000, 120, true, false, false, 21);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-5200-4000-8000-0000001700000001', 'Color- Single Color & Root Touch Ups', 'ALL OVER COLOR WITH HAIRCUT', 'One solid color from scalp to ends, typically darker. *NOT for dimensional color or going lighter* Plus a custom haircut!', 15000, 120, true, false, false, 22);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-5200-4000-8000-0000001800000001', 'Color- Single Color & Root Touch Ups', 'ROOT TOUCH UP WITH A BLOWOUT', 'One solid color intended to touch up all over color. Plus a blowout! 

*NOT for highlights or dimensional lightening*', 8000, 120, true, false, false, 23);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-5200-4000-8000-0000001900000001', 'Color- Single Color & Root Touch Ups', 'ROOT TOUCH UP WITH A HAIRCUT', 'One solid color intended to touch up all over color. Plus a Haircut!

*NOT for highlights or dimensional lightening*', 13000, 120, true, false, false, 24);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-5200-4000-8000-0000001a00000001', 'Color- Single Color & Root Touch Ups', 'GLOSS WITH A BLOWOUT', 'Semi permanent color, intended to slightly tint natural color or refresh the tone of previously lightened hair. Plus a blowout.', 8000, 120, true, false, false, 25);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-5200-4000-8000-0000001b00000001', 'Color- Single Color & Root Touch Ups', 'GLOSS WITH A HAIRCUT', 'Semi permanent color, intended to slightly tint natural color or refresh the tone of previously lightened hair. Plus a custom haircut!', 10500, 120, true, false, false, 26);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-8a00-4000-8000-0000001c00000001', 'Color- Vivids / Fashion Colors', 'COLOR CONSULTATION', 'Not sure what service to schedule for? Curious if your hair goals are achievable? This is for you!

*MUST BE SCHEDULED BEFORE BIG COLOR TRANSFORMATIONS*
*Fee goes towards final service if scheduled at consultation*', 2000, 15, false, false, false, 27);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-8a00-4000-8000-0000001d00000001', 'Color- Vivids / Fashion Colors', 'VIVID TRANSFORMATION', '!! THIS SERVICE REQUIRES A COLOR CONSULTATION BEFORE SCHEDULING !!
** Consults over text accepted as well as in person **
*! Final price equals out to $100/hour.
Intended for full transformation with vivids. Two step process where hair is lifted and then vivid color is applied.', 25000, 120, true, false, true, 28);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-cb00-4000-8000-0000001e00000001', 'Hair Treatments', 'ADD-ON: HOT TOWEL TREATMENT', '*NOT A STANDALONE SERVICE.*
Add a hot towel & aromatherapy to your shampoo experience.', 500, 30, false, true, false, 29);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-cb00-4000-8000-0000001f00000001', 'Hair Treatments', 'ADD-ON: DEEP CONDITION', '*NOT A STANDALONE SERVICE.*
Does your hair need some extra moisture or strengthening? Book this for a custom deep condition and pampering moment!', 2000, 30, true, true, false, 30);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-cb00-4000-8000-0000002000000001', 'Hair Treatments', 'ADD-ON: MALIBU TREATMENT', 'Amazing treatments for pre-color, mineral & buildup removal, post swim or vacation, and more. 
*NOT A STANDALONE SERVICE.*', 3000, 30, true, true, false, 31);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-cb00-4000-8000-0000002100000001', 'Hair Treatments', 'ADD-ON:SCALP REVITALIZING TREATMENT', 'Feel rejuvenated with this scalp & hair treatment!
Fully unwind with a warm, weighted eye mask & cozy aromas. 
»Start off with a stimulating dry brushing. Remove buildup with a double cleanse & scalp scrub. Relax & re-energize with a Jade  comb & thorough massage. Finish with a balancing & hydrating deep condition with a hot towel!
*Ear plugs available for ultimate relaxation*

*NOT A STANDALONE SERVICE.*', 4000, 30, true, true, false, 32);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-cb00-4000-8000-0000002200000001', 'Hair Treatments', 'ADD-ON: K-18 TREATMENT', 'Repair and protect. This can be done with a color service or as a stand alone treatment.
*Must schedule blowout if scheduling a stand alone treatment*', 4000, 30, true, true, false, 33);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-cb00-4000-8000-0000002300000001', 'Hair Treatments', 'ADD-ON: STYLING EDUCATION', 'Some extra 1 on 1 styling education for you!
*NOT A STANDALONE SERVICE.*', 1000, 30, true, true, false, 34);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-cb00-4000-8000-0000002400000001', 'Hair Treatments', 'HAIR TINSEL', 'Make your hair sparkle! 
We have a variety of colors and application methods available- *If you''re wanting a specific color or application method, please leave a note or contact us before appt*
*Price includes 1 application, additional applications are $5 each', 1000, 60, true, false, false, 35);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-cb00-4000-8000-0000002500000001', 'Hair Treatments', 'BLOWOUT', 'Start with a relaxing shampoo and scalp massage and leave with a beautiful style!', 5000, 60, true, false, false, 36);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-cb00-4000-8000-0000002600000001', 'Hair Treatments', 'SILK PRESS', 'Scalp cleanse, deep condition, blow dry & flat iron.', 10000, 60, true, false, false, 37);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-cb00-4000-8000-0000002700000001', 'Hair Treatments', 'KERATIN COMPLEX TREATMENT', 'Transform and revitalize your hair with our Keratin Complex Treatment. This professional service nourishes, and smooths your hair, leaving it sleek, shiny, and frizz-free for weeks. Not sure if this is the service for you? Schedule a complimentary consultation!', 30000, 60, true, false, false, 38);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-1a00-4000-8000-0000002800000001', 'Hair Consultations', 'CONSULTATION FOR KERATIN COMPLEX', 'Curious about getting a keratin treatment? Book this to learn more and see how we can help you!', null, 15, false, false, false, 39);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-1a00-4000-8000-0000002900000001', 'Hair Consultations', 'EXTENSIONS CONSULTATION', 'Curious if extensions are right for you? Book this to learn more!', null, 15, false, false, false, 40);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-d200-4000-8000-0000002a00000001', 'Waxing Services', 'NOSTRIL', 'Get those pesky nose hairs taken care of!', 1500, 30, true, false, false, 41);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-d200-4000-8000-0000002b00000001', 'Waxing Services', 'BACK WAX', null, 7500, 30, false, false, false, 42);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-d200-4000-8000-0000002c00000001', 'Waxing Services', 'BIKINI WAX', null, 4500, 30, false, false, false, 43);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-d200-4000-8000-0000002d00000001', 'Waxing Services', 'BRAZILIAN WAX', null, 8000, 30, false, false, false, 44);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-d200-4000-8000-0000002e00000001', 'Waxing Services', 'BROW MAINTENANCE', 'Quick clean up!', 1500, 30, false, false, false, 45);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-d200-4000-8000-0000002f00000001', 'Waxing Services', 'BROW SHAPING', 'Brows needing a little more TLC, include some tweezing and trimming to get things together.', 2000, 30, false, false, false, 46);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-d200-4000-8000-0000003000000001', 'Waxing Services', 'BUTTOCKS', null, 4500, 30, false, false, false, 47);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-d200-4000-8000-0000003100000001', 'Waxing Services', 'CHEST WAX', null, 7500, 30, false, false, false, 48);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-d200-4000-8000-0000003200000001', 'Waxing Services', 'CHIN', null, 1500, 30, false, false, false, 49);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-d200-4000-8000-0000003300000001', 'Waxing Services', 'EAR', null, 1500, 30, false, false, false, 50);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-d200-4000-8000-0000003400000001', 'Waxing Services', 'FULL ARM WAX', null, 7500, 30, false, false, false, 51);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-d200-4000-8000-0000003500000001', 'Waxing Services', 'FULL LEG WAX', null, 9500, 30, false, false, false, 52);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-d200-4000-8000-0000003600000001', 'Waxing Services', 'HAIR REDUCTION ENZYME ADD ON', 'This enzyme treatment is specially developed for all skin types to help remove unwanted hair growth. The enzyme contains a natural fruit enzyme, papain, which has the ability to gently dissolve keratin (protein constituent of hair), stabilized in an anhydrous gel.

This can be added to any waxing service. This enzyme only works on areas that have been freshly waxed. We will apply the initial application in the treatment room, and you take the rest home to reapply for the next 36 hours. 

Although this blocks out 10 mins on the schedule, it doesn''t actually add any additional time to your service.', 2500, 30, false, false, false, 53);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-d200-4000-8000-0000003700000001', 'Waxing Services', 'HALF ARM WAX', null, 4500, 30, false, false, false, 54);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-d200-4000-8000-0000003800000001', 'Waxing Services', 'HALF LEG', null, 5500, 30, false, false, false, 55);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-d200-4000-8000-0000003900000001', 'Waxing Services', 'LIP', null, 1200, 30, false, false, false, 56);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-d200-4000-8000-0000003a00000001', 'Waxing Services', 'LIP AND CHIN', null, 2000, 30, false, false, false, 57);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-d200-4000-8000-0000003b00000001', 'Waxing Services', 'UNDERARM WAX', null, 3500, 30, false, false, false, 58);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-d200-4000-8000-0000003c00000001', 'Waxing Services', 'FULL FACE WAX', 'A full face wax can include brow, lip, chin as well as the sides of the face, and under the jawline.', 4000, 30, false, false, false, 59);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-9400-4000-8000-0000003d00000001', 'Skincare Services', 'BESPOKE KOREAN FACIAL- 60 MINUTES', 'Enjoy a personalized facial experience where every step is tailored to your unique skincare concerns and goals, ensuring that you get the most out of your visit with individualized protocols and targeted treatments.', 12500, 60, false, false, false, 60);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-9400-4000-8000-0000003e00000001', 'Skincare Services', 'ACNE FACIAL- INITIAL VISIT', 'Our Acne Facial combines advanced techniques and carefully chosen products to combat blemishes, breakouts, and congestion for clearer, healthier skin. With a focus on preserving the integrity of the epidermis, our Korean-inspired approach minimizes unnecessary stimulation to the skin''s defense and immune systems.
Proper homecare is required to achieve the desired results, so cost of the first treatment includes professional product for use at home.', 30000, 60, false, false, false, 61);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-9400-4000-8000-0000003f00000001', 'Skincare Services', 'ACNE FACIAL-RETURNING CLIENT', 'Our Acne Facial combines advanced techniques and carefully chosen products to combat blemishes, breakouts, and congestion for clearer, healthier skin. With a focus on preserving the integrity of the epidermis, our Korean-inspired approach minimizes unnecessary stimulation to the skin''s defense and immune systems.', 17500, 60, false, false, false, 62);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-9400-4000-8000-0000004000000001', 'Skincare Services', 'BESPOKE KOREAN FACIAL- 30 MINUTES', 'Enjoy a personalized facial experience where every step is tailored to your unique skincare concerns and goals, ensuring that you get the most out of your visit with individualized protocols and targeted treatments. These facials can include one or more of the following treatments, depending on time', 7500, 60, false, false, false, 63);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-9400-4000-8000-0000004100000001', 'Skincare Services', 'BESPOKE KOREAN FACIAL- 90 MINUTES', 'Enjoy a personalized facial experience where every step is tailored to your unique skincare concerns and goals, ensuring that you get the most out of your visit with individualized protocols and targeted treatments.', 17500, 90, false, false, false, 64);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-9400-4000-8000-0000004200000001', 'Skincare Services', 'GLOW PEEL', 'This gentle brightening and rejuvenating peel leaves skin glowing, lightening hyperpigmentation, and working beneath the skin’s surface to repair free radical damage at the cellular level.  Glow Peel features a gently acidic 2.9pH profile, with 40% glycolic acid to exfoliate surface skin cells and reveal healthy, vibrant skin beneath. Often referred to as a “lunchtime peel,” Glow Peel requires no downtime, leaving skin softer, smoother, and brighter in under an hour.', 12500, 60, false, false, false, 65);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-9400-4000-8000-0000004300000001', 'Skincare Services', 'GREEN SEA SPICULE PEEL-1ST PEEL', 'Spicule Peels are a resurfacing treatment that is natural, safe for all fitzpatricks, and safe during pregnancy. This is ideal for treating texture issues (particularly acne scarring) and hyperpigmentation. This peel works by driving spicules into the skin, which stimulates collagen, exfoliates, and pulls pigment, all while delivering a polypharmacy of vitamins and nutrients into the skin. 

This peel requires 2 weeks of at home prep, and the cost of the service includes the required homecare products for both pre & post peel.', 25000, 60, false, false, false, 66);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-9400-4000-8000-0000004400000001', 'Skincare Services', 'GREEN SEA PEEL-RETURNING CLIENT', 'Choose this for all additional GSP treatments after your initial Green Sea Peel.', 17500, 60, false, false, false, 67);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-9400-4000-8000-0000004500000001', 'Skincare Services', 'ILLUMIN BIPHASIC CHEMICAL PEEL', 'The Illumin peel is best for treating acne, scar reduction, hyperpigmentation, and balancing overactive sebum. This is an advanced treatment, and cannot be done on your first visit.', 12500, 60, false, false, false, 68);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-9400-4000-8000-0000004600000001', 'Skincare Services', 'KOREAN NEEDLE-FREE FILLER FACIAL', 'This non-invasive, anti-aging skincare treatment softens fine lines & wrinkles by plumping the skin and adding volume back to the face & neck . Poly L-Lactic Acid is applied topically with a blend of other anti-aging ingredients and driven in with a patented delivery system. Collagen stimulation continues for 3 weeks after a single treatment, and up to 5 months after a series of 3-5 treatment done a week apart.', 20000, 60, false, false, false, 69);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-9400-4000-8000-0000004700000001', 'Skincare Services', 'LAZER PEEL', 'The LaZer Peel is a medium-depth peel (pH 1.7). This peel is incredible for tackling stubborn hyperpigmentation including Melasma. 

This is a strong peel that will require some downtime, and is only available to regular clients, due to the importance of following all pre and post peel care requirements for best results. This cannot be booked for your first visit.', 17500, 60, false, false, false, 70);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-9400-4000-8000-0000004800000001', 'Skincare Services', 'SUNBURN RX EXPRESS', 'Get a quick and rejuvenating Sunburn RX Express treatment that uses Korean skincare products to soothe, hydrate, and heal sunburnt skin in just 30 minutes, leaving you with a refreshed complexion and relief from discomfort. Embrace the revitalizing effects and enjoy a renewed glow', 7500, 60, false, false, false, 71);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-9400-4000-8000-0000004900000001', 'Skincare Services', 'CLEAR PEEL', 'This incredible formula helps treat acne and reduce inflammation.  This peel helps to calm redness, soothe irritation, and combat the oxidative stress that can contribute to acne and post-inflammatory hyperpigmentation.', 12500, 60, false, false, false, 72);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-9400-4000-8000-0000004a00000001', 'Skincare Services', 'SKINCARE CONSULTATION', 'Don’t know where to start? Book a complimentary 15 minute skincare consultation!', null, 15, false, false, false, 73);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-c700-4000-8000-0000004b00000001', 'Makeup Services', 'MAKEUP APPLICATION (BEAUTY MAKEUP)', 'Elevate your beauty experience! I specialize in creating personalized looks that celebrate your individuality!', 12500, 60, true, false, false, 74);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-c700-4000-8000-0000004c00000001', 'Makeup Services', 'FX/BODY PAINTING MAKEUP', 'Every day is Halloween in Irvington! SFX and Body Painting Makeup Appointments are your ticket to a world of stunning transformations, from otherworldly creatures to realistic injury simulations. Whether you dream of becoming an alien, monster, or fantastical being, I can bring your vision to life! These appointments will require a (free) consultation, as well as additional cost for materials, depending on design. Application can be on or off site, depending on need.', 25000, 60, true, false, false, 75);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-c700-4000-8000-0000004d00000001', 'Makeup Services', 'MAKEUP CONSULTATION', 'Before diving into the good stuff, let''s sit down for a Makeup Consultation! This consultation not only sets the stage for a personalized experience but also ensures you''re confident in your service choice. This is required before booking any makeup application service.', null, 15, false, false, false, 76);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-c700-4000-8000-0000004e00000001', 'Makeup Services', 'MAKEUP LESSON', 'Want some help with your makeup game? Let''s work together to level up! We can take a look at what you''re already doing, what products you''re using, what''s working for you, what isn''t and from that, we''ll create a makeup routine that works for you. We can also discuss application and "how-to" at each step along the way! These lessons are for you, always 1 on 1, and we can address whatever you''d like.', 15000, 60, true, false, false, 77);
insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values ('b2000001-c700-4000-8000-0000004f00000001', 'Makeup Services', 'PERSONAL SHOPPING', null, 5000, 60, true, false, false, 78);

-- staff_services (all bookable staff × non-add-on services)
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000001', 'b2000001-4300-4000-8000-0000000200000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000001', 'b2000001-4300-4000-8000-0000000300000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000001', 'b2000001-4300-4000-8000-0000000400000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000001', 'b2000001-4300-4000-8000-0000000500000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000001', 'b2000001-4300-4000-8000-0000000600000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000001', 'b2000001-4300-4000-8000-0000000700000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000001', 'b2000001-4300-4000-8000-0000000800000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000001', 'b2000001-4300-4000-8000-0000000900000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000001', 'b2000001-4300-4000-8000-0000000a00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000001', 'b2000001-4300-4000-8000-0000000b00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000001', 'b2000001-de00-4000-8000-0000000c00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000001', 'b2000001-de00-4000-8000-0000000d00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000001', 'b2000001-de00-4000-8000-0000000e00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000001', 'b2000001-de00-4000-8000-0000000f00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000001', 'b2000001-de00-4000-8000-0000001000000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000001', 'b2000001-de00-4000-8000-0000001100000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000001', 'b2000001-8700-4000-8000-0000001200000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000001', 'b2000001-8700-4000-8000-0000001300000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000001', 'b2000001-8700-4000-8000-0000001400000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000001', 'b2000001-8700-4000-8000-0000001500000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000001', 'b2000001-5200-4000-8000-0000001600000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000001', 'b2000001-5200-4000-8000-0000001700000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000001', 'b2000001-5200-4000-8000-0000001800000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000001', 'b2000001-5200-4000-8000-0000001900000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000001', 'b2000001-5200-4000-8000-0000001a00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000001', 'b2000001-5200-4000-8000-0000001b00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000001', 'b2000001-8a00-4000-8000-0000001c00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000001', 'b2000001-8a00-4000-8000-0000001d00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000001', 'b2000001-cb00-4000-8000-0000002400000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000001', 'b2000001-cb00-4000-8000-0000002500000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000001', 'b2000001-cb00-4000-8000-0000002600000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000001', 'b2000001-cb00-4000-8000-0000002700000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000001', 'b2000001-1a00-4000-8000-0000002800000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000001', 'b2000001-1a00-4000-8000-0000002900000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000001', 'b2000001-d200-4000-8000-0000002a00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000001', 'b2000001-d200-4000-8000-0000002b00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000001', 'b2000001-d200-4000-8000-0000002c00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000001', 'b2000001-d200-4000-8000-0000002d00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000001', 'b2000001-d200-4000-8000-0000002e00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000001', 'b2000001-d200-4000-8000-0000002f00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000001', 'b2000001-d200-4000-8000-0000003000000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000001', 'b2000001-d200-4000-8000-0000003100000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000001', 'b2000001-d200-4000-8000-0000003200000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000001', 'b2000001-d200-4000-8000-0000003300000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000001', 'b2000001-d200-4000-8000-0000003400000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000001', 'b2000001-d200-4000-8000-0000003500000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000001', 'b2000001-d200-4000-8000-0000003600000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000001', 'b2000001-d200-4000-8000-0000003700000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000001', 'b2000001-d200-4000-8000-0000003800000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000001', 'b2000001-d200-4000-8000-0000003900000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000001', 'b2000001-d200-4000-8000-0000003a00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000001', 'b2000001-d200-4000-8000-0000003b00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000001', 'b2000001-d200-4000-8000-0000003c00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000002', 'b2000001-4300-4000-8000-0000000200000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000002', 'b2000001-4300-4000-8000-0000000300000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000002', 'b2000001-4300-4000-8000-0000000400000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000002', 'b2000001-4300-4000-8000-0000000500000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000002', 'b2000001-4300-4000-8000-0000000600000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000002', 'b2000001-4300-4000-8000-0000000700000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000002', 'b2000001-4300-4000-8000-0000000800000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000002', 'b2000001-4300-4000-8000-0000000900000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000002', 'b2000001-4300-4000-8000-0000000a00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000002', 'b2000001-4300-4000-8000-0000000b00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000002', 'b2000001-de00-4000-8000-0000000c00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000002', 'b2000001-de00-4000-8000-0000000d00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000002', 'b2000001-de00-4000-8000-0000000e00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000002', 'b2000001-de00-4000-8000-0000000f00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000002', 'b2000001-de00-4000-8000-0000001000000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000002', 'b2000001-de00-4000-8000-0000001100000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000002', 'b2000001-8700-4000-8000-0000001200000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000002', 'b2000001-8700-4000-8000-0000001300000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000002', 'b2000001-8700-4000-8000-0000001400000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000002', 'b2000001-8700-4000-8000-0000001500000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000002', 'b2000001-5200-4000-8000-0000001600000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000002', 'b2000001-5200-4000-8000-0000001700000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000002', 'b2000001-5200-4000-8000-0000001800000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000002', 'b2000001-5200-4000-8000-0000001900000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000002', 'b2000001-5200-4000-8000-0000001a00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000002', 'b2000001-5200-4000-8000-0000001b00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000002', 'b2000001-8a00-4000-8000-0000001c00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000002', 'b2000001-8a00-4000-8000-0000001d00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000002', 'b2000001-cb00-4000-8000-0000002400000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000002', 'b2000001-cb00-4000-8000-0000002500000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000002', 'b2000001-cb00-4000-8000-0000002600000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000002', 'b2000001-cb00-4000-8000-0000002700000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000002', 'b2000001-1a00-4000-8000-0000002800000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000002', 'b2000001-1a00-4000-8000-0000002900000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000002', 'b2000001-d200-4000-8000-0000002a00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000002', 'b2000001-d200-4000-8000-0000002b00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000002', 'b2000001-d200-4000-8000-0000002c00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000002', 'b2000001-d200-4000-8000-0000002d00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000002', 'b2000001-d200-4000-8000-0000002e00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000002', 'b2000001-d200-4000-8000-0000002f00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000002', 'b2000001-d200-4000-8000-0000003000000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000002', 'b2000001-d200-4000-8000-0000003100000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000002', 'b2000001-d200-4000-8000-0000003200000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000002', 'b2000001-d200-4000-8000-0000003300000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000002', 'b2000001-d200-4000-8000-0000003400000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000002', 'b2000001-d200-4000-8000-0000003500000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000002', 'b2000001-d200-4000-8000-0000003600000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000002', 'b2000001-d200-4000-8000-0000003700000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000002', 'b2000001-d200-4000-8000-0000003800000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000002', 'b2000001-d200-4000-8000-0000003900000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000002', 'b2000001-d200-4000-8000-0000003a00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000002', 'b2000001-d200-4000-8000-0000003b00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000002', 'b2000001-d200-4000-8000-0000003c00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000003', 'b2000001-4300-4000-8000-0000000200000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000003', 'b2000001-4300-4000-8000-0000000300000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000003', 'b2000001-4300-4000-8000-0000000400000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000003', 'b2000001-4300-4000-8000-0000000500000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000003', 'b2000001-4300-4000-8000-0000000600000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000003', 'b2000001-4300-4000-8000-0000000700000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000003', 'b2000001-4300-4000-8000-0000000800000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000003', 'b2000001-4300-4000-8000-0000000900000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000003', 'b2000001-4300-4000-8000-0000000a00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000003', 'b2000001-4300-4000-8000-0000000b00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000003', 'b2000001-de00-4000-8000-0000000c00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000003', 'b2000001-de00-4000-8000-0000000d00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000003', 'b2000001-de00-4000-8000-0000000e00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000003', 'b2000001-de00-4000-8000-0000000f00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000003', 'b2000001-de00-4000-8000-0000001000000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000003', 'b2000001-de00-4000-8000-0000001100000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000003', 'b2000001-8700-4000-8000-0000001200000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000003', 'b2000001-8700-4000-8000-0000001300000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000003', 'b2000001-8700-4000-8000-0000001400000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000003', 'b2000001-8700-4000-8000-0000001500000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000003', 'b2000001-5200-4000-8000-0000001600000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000003', 'b2000001-5200-4000-8000-0000001700000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000003', 'b2000001-5200-4000-8000-0000001800000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000003', 'b2000001-5200-4000-8000-0000001900000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000003', 'b2000001-5200-4000-8000-0000001a00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000003', 'b2000001-5200-4000-8000-0000001b00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000003', 'b2000001-8a00-4000-8000-0000001c00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000003', 'b2000001-8a00-4000-8000-0000001d00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000003', 'b2000001-cb00-4000-8000-0000002400000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000003', 'b2000001-cb00-4000-8000-0000002500000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000003', 'b2000001-cb00-4000-8000-0000002600000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000003', 'b2000001-cb00-4000-8000-0000002700000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000003', 'b2000001-1a00-4000-8000-0000002800000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000003', 'b2000001-1a00-4000-8000-0000002900000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000003', 'b2000001-d200-4000-8000-0000002a00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000003', 'b2000001-d200-4000-8000-0000002b00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000003', 'b2000001-d200-4000-8000-0000002c00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000003', 'b2000001-d200-4000-8000-0000002d00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000003', 'b2000001-d200-4000-8000-0000002e00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000003', 'b2000001-d200-4000-8000-0000002f00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000003', 'b2000001-d200-4000-8000-0000003000000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000003', 'b2000001-d200-4000-8000-0000003100000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000003', 'b2000001-d200-4000-8000-0000003200000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000003', 'b2000001-d200-4000-8000-0000003300000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000003', 'b2000001-d200-4000-8000-0000003400000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000003', 'b2000001-d200-4000-8000-0000003500000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000003', 'b2000001-d200-4000-8000-0000003600000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000003', 'b2000001-d200-4000-8000-0000003700000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000003', 'b2000001-d200-4000-8000-0000003800000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000003', 'b2000001-d200-4000-8000-0000003900000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000003', 'b2000001-d200-4000-8000-0000003a00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000003', 'b2000001-d200-4000-8000-0000003b00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000003', 'b2000001-d200-4000-8000-0000003c00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000004', 'b2000001-4300-4000-8000-0000000200000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000004', 'b2000001-4300-4000-8000-0000000300000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000004', 'b2000001-4300-4000-8000-0000000400000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000004', 'b2000001-4300-4000-8000-0000000500000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000004', 'b2000001-4300-4000-8000-0000000600000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000004', 'b2000001-4300-4000-8000-0000000700000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000004', 'b2000001-4300-4000-8000-0000000800000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000004', 'b2000001-4300-4000-8000-0000000900000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000004', 'b2000001-4300-4000-8000-0000000a00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000004', 'b2000001-4300-4000-8000-0000000b00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000004', 'b2000001-de00-4000-8000-0000000c00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000004', 'b2000001-de00-4000-8000-0000000d00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000004', 'b2000001-de00-4000-8000-0000000e00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000004', 'b2000001-de00-4000-8000-0000000f00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000004', 'b2000001-de00-4000-8000-0000001000000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000004', 'b2000001-de00-4000-8000-0000001100000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000004', 'b2000001-8700-4000-8000-0000001200000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000004', 'b2000001-8700-4000-8000-0000001300000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000004', 'b2000001-8700-4000-8000-0000001400000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000004', 'b2000001-8700-4000-8000-0000001500000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000004', 'b2000001-5200-4000-8000-0000001600000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000004', 'b2000001-5200-4000-8000-0000001700000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000004', 'b2000001-5200-4000-8000-0000001800000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000004', 'b2000001-5200-4000-8000-0000001900000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000004', 'b2000001-5200-4000-8000-0000001a00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000004', 'b2000001-5200-4000-8000-0000001b00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000004', 'b2000001-8a00-4000-8000-0000001c00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000004', 'b2000001-8a00-4000-8000-0000001d00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000004', 'b2000001-cb00-4000-8000-0000002400000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000004', 'b2000001-cb00-4000-8000-0000002500000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000004', 'b2000001-cb00-4000-8000-0000002600000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000004', 'b2000001-cb00-4000-8000-0000002700000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000004', 'b2000001-1a00-4000-8000-0000002800000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000004', 'b2000001-1a00-4000-8000-0000002900000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000004', 'b2000001-d200-4000-8000-0000002a00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000004', 'b2000001-d200-4000-8000-0000002b00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000004', 'b2000001-d200-4000-8000-0000002c00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000004', 'b2000001-d200-4000-8000-0000002d00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000004', 'b2000001-d200-4000-8000-0000002e00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000004', 'b2000001-d200-4000-8000-0000002f00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000004', 'b2000001-d200-4000-8000-0000003000000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000004', 'b2000001-d200-4000-8000-0000003100000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000004', 'b2000001-d200-4000-8000-0000003200000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000004', 'b2000001-d200-4000-8000-0000003300000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000004', 'b2000001-d200-4000-8000-0000003400000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000004', 'b2000001-d200-4000-8000-0000003500000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000004', 'b2000001-d200-4000-8000-0000003600000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000004', 'b2000001-d200-4000-8000-0000003700000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000004', 'b2000001-d200-4000-8000-0000003800000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000004', 'b2000001-d200-4000-8000-0000003900000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000004', 'b2000001-d200-4000-8000-0000003a00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000004', 'b2000001-d200-4000-8000-0000003b00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000004', 'b2000001-d200-4000-8000-0000003c00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000005', 'b2000001-4300-4000-8000-0000000200000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000005', 'b2000001-4300-4000-8000-0000000300000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000005', 'b2000001-4300-4000-8000-0000000400000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000005', 'b2000001-4300-4000-8000-0000000500000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000005', 'b2000001-4300-4000-8000-0000000600000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000005', 'b2000001-4300-4000-8000-0000000700000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000005', 'b2000001-4300-4000-8000-0000000800000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000005', 'b2000001-4300-4000-8000-0000000900000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000005', 'b2000001-4300-4000-8000-0000000a00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000005', 'b2000001-4300-4000-8000-0000000b00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000005', 'b2000001-de00-4000-8000-0000000c00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000005', 'b2000001-de00-4000-8000-0000000d00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000005', 'b2000001-de00-4000-8000-0000000e00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000005', 'b2000001-de00-4000-8000-0000000f00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000005', 'b2000001-de00-4000-8000-0000001000000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000005', 'b2000001-de00-4000-8000-0000001100000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000005', 'b2000001-8700-4000-8000-0000001200000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000005', 'b2000001-8700-4000-8000-0000001300000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000005', 'b2000001-8700-4000-8000-0000001400000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000005', 'b2000001-8700-4000-8000-0000001500000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000005', 'b2000001-5200-4000-8000-0000001600000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000005', 'b2000001-5200-4000-8000-0000001700000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000005', 'b2000001-5200-4000-8000-0000001800000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000005', 'b2000001-5200-4000-8000-0000001900000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000005', 'b2000001-5200-4000-8000-0000001a00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000005', 'b2000001-5200-4000-8000-0000001b00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000005', 'b2000001-8a00-4000-8000-0000001c00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000005', 'b2000001-8a00-4000-8000-0000001d00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000005', 'b2000001-cb00-4000-8000-0000002400000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000005', 'b2000001-cb00-4000-8000-0000002500000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000005', 'b2000001-cb00-4000-8000-0000002600000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000005', 'b2000001-cb00-4000-8000-0000002700000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000005', 'b2000001-1a00-4000-8000-0000002800000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000005', 'b2000001-1a00-4000-8000-0000002900000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000005', 'b2000001-d200-4000-8000-0000002a00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000005', 'b2000001-d200-4000-8000-0000002b00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000005', 'b2000001-d200-4000-8000-0000002c00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000005', 'b2000001-d200-4000-8000-0000002d00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000005', 'b2000001-d200-4000-8000-0000002e00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000005', 'b2000001-d200-4000-8000-0000002f00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000005', 'b2000001-d200-4000-8000-0000003000000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000005', 'b2000001-d200-4000-8000-0000003100000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000005', 'b2000001-d200-4000-8000-0000003200000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000005', 'b2000001-d200-4000-8000-0000003300000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000005', 'b2000001-d200-4000-8000-0000003400000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000005', 'b2000001-d200-4000-8000-0000003500000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000005', 'b2000001-d200-4000-8000-0000003600000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000005', 'b2000001-d200-4000-8000-0000003700000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000005', 'b2000001-d200-4000-8000-0000003800000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000005', 'b2000001-d200-4000-8000-0000003900000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000005', 'b2000001-d200-4000-8000-0000003a00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000005', 'b2000001-d200-4000-8000-0000003b00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000005', 'b2000001-d200-4000-8000-0000003c00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000006', 'b2000001-4300-4000-8000-0000000200000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000006', 'b2000001-4300-4000-8000-0000000300000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000006', 'b2000001-4300-4000-8000-0000000400000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000006', 'b2000001-4300-4000-8000-0000000500000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000006', 'b2000001-4300-4000-8000-0000000600000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000006', 'b2000001-4300-4000-8000-0000000700000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000006', 'b2000001-4300-4000-8000-0000000800000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000006', 'b2000001-4300-4000-8000-0000000900000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000006', 'b2000001-4300-4000-8000-0000000a00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000006', 'b2000001-4300-4000-8000-0000000b00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000006', 'b2000001-de00-4000-8000-0000000c00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000006', 'b2000001-de00-4000-8000-0000000d00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000006', 'b2000001-de00-4000-8000-0000000e00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000006', 'b2000001-de00-4000-8000-0000000f00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000006', 'b2000001-de00-4000-8000-0000001000000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000006', 'b2000001-de00-4000-8000-0000001100000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000006', 'b2000001-8700-4000-8000-0000001200000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000006', 'b2000001-8700-4000-8000-0000001300000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000006', 'b2000001-8700-4000-8000-0000001400000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000006', 'b2000001-8700-4000-8000-0000001500000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000006', 'b2000001-5200-4000-8000-0000001600000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000006', 'b2000001-5200-4000-8000-0000001700000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000006', 'b2000001-5200-4000-8000-0000001800000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000006', 'b2000001-5200-4000-8000-0000001900000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000006', 'b2000001-5200-4000-8000-0000001a00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000006', 'b2000001-5200-4000-8000-0000001b00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000006', 'b2000001-8a00-4000-8000-0000001c00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000006', 'b2000001-8a00-4000-8000-0000001d00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000006', 'b2000001-cb00-4000-8000-0000002400000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000006', 'b2000001-cb00-4000-8000-0000002500000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000006', 'b2000001-cb00-4000-8000-0000002600000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000006', 'b2000001-cb00-4000-8000-0000002700000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000006', 'b2000001-1a00-4000-8000-0000002800000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000006', 'b2000001-1a00-4000-8000-0000002900000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000006', 'b2000001-d200-4000-8000-0000002a00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000006', 'b2000001-d200-4000-8000-0000002b00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000006', 'b2000001-d200-4000-8000-0000002c00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000006', 'b2000001-d200-4000-8000-0000002d00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000006', 'b2000001-d200-4000-8000-0000002e00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000006', 'b2000001-d200-4000-8000-0000002f00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000006', 'b2000001-d200-4000-8000-0000003000000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000006', 'b2000001-d200-4000-8000-0000003100000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000006', 'b2000001-d200-4000-8000-0000003200000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000006', 'b2000001-d200-4000-8000-0000003300000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000006', 'b2000001-d200-4000-8000-0000003400000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000006', 'b2000001-d200-4000-8000-0000003500000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000006', 'b2000001-d200-4000-8000-0000003600000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000006', 'b2000001-d200-4000-8000-0000003700000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000006', 'b2000001-d200-4000-8000-0000003800000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000006', 'b2000001-d200-4000-8000-0000003900000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000006', 'b2000001-d200-4000-8000-0000003a00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000006', 'b2000001-d200-4000-8000-0000003b00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000006', 'b2000001-d200-4000-8000-0000003c00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000007', 'b2000001-1a00-4000-8000-0000002800000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000007', 'b2000001-1a00-4000-8000-0000002900000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000007', 'b2000001-d200-4000-8000-0000002a00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000007', 'b2000001-d200-4000-8000-0000002b00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000007', 'b2000001-d200-4000-8000-0000002c00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000007', 'b2000001-d200-4000-8000-0000002d00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000007', 'b2000001-d200-4000-8000-0000002e00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000007', 'b2000001-d200-4000-8000-0000002f00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000007', 'b2000001-d200-4000-8000-0000003000000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000007', 'b2000001-d200-4000-8000-0000003100000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000007', 'b2000001-d200-4000-8000-0000003200000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000007', 'b2000001-d200-4000-8000-0000003300000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000007', 'b2000001-d200-4000-8000-0000003400000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000007', 'b2000001-d200-4000-8000-0000003500000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000007', 'b2000001-d200-4000-8000-0000003600000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000007', 'b2000001-d200-4000-8000-0000003700000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000007', 'b2000001-d200-4000-8000-0000003800000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000007', 'b2000001-d200-4000-8000-0000003900000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000007', 'b2000001-d200-4000-8000-0000003a00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000007', 'b2000001-d200-4000-8000-0000003b00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000007', 'b2000001-d200-4000-8000-0000003c00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000007', 'b2000001-9400-4000-8000-0000003d00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000007', 'b2000001-9400-4000-8000-0000003e00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000007', 'b2000001-9400-4000-8000-0000003f00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000007', 'b2000001-9400-4000-8000-0000004000000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000007', 'b2000001-9400-4000-8000-0000004100000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000007', 'b2000001-9400-4000-8000-0000004200000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000007', 'b2000001-9400-4000-8000-0000004300000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000007', 'b2000001-9400-4000-8000-0000004400000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000007', 'b2000001-9400-4000-8000-0000004500000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000007', 'b2000001-9400-4000-8000-0000004600000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000007', 'b2000001-9400-4000-8000-0000004700000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000007', 'b2000001-9400-4000-8000-0000004800000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000007', 'b2000001-9400-4000-8000-0000004900000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000007', 'b2000001-9400-4000-8000-0000004a00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000007', 'b2000001-c700-4000-8000-0000004b00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000007', 'b2000001-c700-4000-8000-0000004c00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000007', 'b2000001-c700-4000-8000-0000004d00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000007', 'b2000001-c700-4000-8000-0000004e00000001');
insert into public.staff_services (staff_id, service_id) values ('a1000001-0001-4000-8000-000000000007', 'b2000001-c700-4000-8000-0000004f00000001');

commit;
