CREATE TABLE "auth_throttle" (
	"key" text PRIMARY KEY NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"window_start" timestamp with time zone NOT NULL
);
