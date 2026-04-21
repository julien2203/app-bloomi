alter table public.profiles
add column if not exists push_notification_settings jsonb not null default
'{
  "enabled": true,
  "newMessage": true,
  "newFeedback": true,
  "favoriteItems": true,
  "newFollowers": true,
  "newItems": true
}'::jsonb;
