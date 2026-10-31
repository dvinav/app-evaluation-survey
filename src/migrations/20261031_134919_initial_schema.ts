import {
  type MigrateUpArgs,
  type MigrateDownArgs,
  sql,
} from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_companies_participation_status" AS ENUM('pending', 'agreed', 'withdrawn');
  CREATE TYPE "public"."enum_companies_interview_progress" AS ENUM('not-scheduled', 'scheduled', 'completed');
  CREATE TYPE "public"."enum_survey_submissions_background" AS ENUM('ui-ux', 'software', 'other');
  CREATE TYPE "public"."enum_survey_submissions_mode" AS ENUM('general', 'detailed');
  CREATE TYPE "public"."enum_application_evaluations_mode" AS ENUM('general', 'detailed');
  CREATE TYPE "public"."enum_question_responses_status" AS ENUM('rated', 'not-applicable', 'unanswered');
  CREATE TYPE "public"."enum_exports_format" AS ENUM('csv', 'json');
  CREATE TYPE "public"."enum_exports_sort_order" AS ENUM('asc', 'desc');
  CREATE TYPE "public"."enum_exports_drafts" AS ENUM('yes', 'no');
  CREATE TYPE "public"."enum_imports_import_mode" AS ENUM('create', 'update', 'upsert');
  CREATE TYPE "public"."enum_imports_status" AS ENUM('pending', 'completed', 'partial', 'failed');
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'createCollectionExport', 'createCollectionImport');
  CREATE TYPE "public"."enum_payload_jobs_log_state" AS ENUM('failed', 'succeeded');
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'createCollectionExport', 'createCollectionImport');
  CREATE TABLE "admin_users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "admin_users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"reset_password_requested_at" timestamp(3) with time zone,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "companies" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"website" varchar,
  	"description" varchar,
  	"participation_status" "enum_companies_participation_status" DEFAULT 'pending' NOT NULL,
  	"interview_agreement" boolean DEFAULT false,
  	"interview_progress" "enum_companies_interview_progress" DEFAULT 'not-scheduled',
  	"private_notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "applications" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"icon_id" integer NOT NULL,
  	"company_id" integer NOT NULL,
  	"url" varchar,
  	"category" varchar,
  	"active" boolean DEFAULT false,
  	"public" boolean DEFAULT false,
  	"display_order" numeric DEFAULT 0 NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "general_questions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"stable_id" varchar NOT NULL,
  	"text" varchar NOT NULL,
  	"description" varchar,
  	"display_order" numeric DEFAULT 0 NOT NULL,
  	"required" boolean DEFAULT true,
  	"active" boolean DEFAULT false,
  	"dimension" varchar,
  	"reverse_scored" boolean DEFAULT false,
  	"allow_n_a" boolean DEFAULT false,
  	"version" numeric DEFAULT 1 NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "detailed_questions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"stable_id" varchar NOT NULL,
  	"text" varchar NOT NULL,
  	"description" varchar,
  	"display_order" numeric DEFAULT 0 NOT NULL,
  	"required" boolean DEFAULT true,
  	"active" boolean DEFAULT false,
  	"dimension" varchar,
  	"reverse_scored" boolean DEFAULT false,
  	"allow_n_a" boolean DEFAULT false,
  	"version" numeric DEFAULT 1 NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric,
  	"sizes_icon_url" varchar,
  	"sizes_icon_width" numeric,
  	"sizes_icon_height" numeric,
  	"sizes_icon_mime_type" varchar,
  	"sizes_icon_filesize" numeric,
  	"sizes_icon_filename" varchar
  );
  
  CREATE TABLE "survey_submissions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"submission_id" varchar NOT NULL,
  	"request_hash" varchar NOT NULL,
  	"first_name" varchar,
  	"surname" varchar,
  	"background" "enum_survey_submissions_background" NOT NULL,
  	"profile_url" varchar,
  	"mode" "enum_survey_submissions_mode" NOT NULL,
  	"questionnaire_version" varchar NOT NULL,
  	"consent_version" varchar NOT NULL,
  	"consented_at" timestamp(3) with time zone NOT NULL,
  	"snapshot" jsonb NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "application_evaluations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"submission_id" integer NOT NULL,
  	"application_id" integer NOT NULL,
  	"company_id" integer NOT NULL,
  	"application_name" varchar NOT NULL,
  	"company_name" varchar NOT NULL,
  	"mode" "enum_application_evaluations_mode" NOT NULL,
  	"questionnaire_version" varchar NOT NULL,
  	"question_count" numeric NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "question_responses" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"evaluation_id" integer NOT NULL,
  	"question_id" varchar NOT NULL,
  	"question_text" varchar NOT NULL,
  	"question_version" numeric NOT NULL,
  	"dimension" varchar,
  	"reverse_scored" boolean DEFAULT false NOT NULL,
  	"required" boolean DEFAULT false NOT NULL,
  	"status" "enum_question_responses_status" NOT NULL,
  	"rating" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "research_results_contacts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"email" varchar NOT NULL,
  	"submission_id" integer NOT NULL,
  	"subscribed_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "exports" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"format" "enum_exports_format" DEFAULT 'csv' NOT NULL,
  	"limit" numeric,
  	"page" numeric DEFAULT 1,
  	"sort" varchar,
  	"sort_order" "enum_exports_sort_order",
  	"drafts" "enum_exports_drafts" DEFAULT 'yes',
  	"collection_slug" varchar DEFAULT 'companies' NOT NULL,
  	"where" jsonb DEFAULT '{}'::jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "exports_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "imports" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"collection_slug" varchar NOT NULL,
  	"import_mode" "enum_imports_import_mode",
  	"match_field" varchar DEFAULT 'id',
  	"status" "enum_imports_status" DEFAULT 'pending',
  	"summary_imported" numeric,
  	"summary_updated" numeric,
  	"summary_total" numeric,
  	"summary_issues" numeric,
  	"summary_issue_details" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_jobs_log" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"executed_at" timestamp(3) with time zone NOT NULL,
  	"completed_at" timestamp(3) with time zone NOT NULL,
  	"task_slug" "enum_payload_jobs_log_task_slug" NOT NULL,
  	"task_i_d" varchar NOT NULL,
  	"input" jsonb,
  	"output" jsonb,
  	"state" "enum_payload_jobs_log_state" NOT NULL,
  	"error" jsonb
  );
  
  CREATE TABLE "payload_jobs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"input" jsonb,
  	"completed_at" timestamp(3) with time zone,
  	"total_tried" numeric DEFAULT 0,
  	"has_error" boolean DEFAULT false,
  	"error" jsonb,
  	"task_slug" "enum_payload_jobs_task_slug",
  	"queue" varchar DEFAULT 'default',
  	"wait_until" timestamp(3) with time zone,
  	"processing" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"admin_users_id" integer,
  	"companies_id" integer,
  	"applications_id" integer,
  	"general_questions_id" integer,
  	"detailed_questions_id" integer,
  	"media_id" integer,
  	"survey_submissions_id" integer,
  	"application_evaluations_id" integer,
  	"question_responses_id" integer,
  	"research_results_contacts_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"admin_users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "research_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"description" varchar NOT NULL,
  	"introduction" varchar NOT NULL,
  	"consent_text" varchar NOT NULL,
  	"consent_version" varchar NOT NULL,
  	"contact" varchar NOT NULL,
  	"available" boolean DEFAULT false,
  	"closing_message" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "admin_users_sessions" ADD CONSTRAINT "admin_users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "applications" ADD CONSTRAINT "applications_icon_id_media_id_fk" FOREIGN KEY ("icon_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "applications" ADD CONSTRAINT "applications_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "application_evaluations" ADD CONSTRAINT "application_evaluations_submission_id_survey_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."survey_submissions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "application_evaluations" ADD CONSTRAINT "application_evaluations_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "application_evaluations" ADD CONSTRAINT "application_evaluations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "question_responses" ADD CONSTRAINT "question_responses_evaluation_id_application_evaluations_id_fk" FOREIGN KEY ("evaluation_id") REFERENCES "public"."application_evaluations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "research_results_contacts" ADD CONSTRAINT "research_results_contacts_submission_id_survey_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."survey_submissions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "exports_texts" ADD CONSTRAINT "exports_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."exports"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_jobs_log" ADD CONSTRAINT "payload_jobs_log_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."payload_jobs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_admin_users_fk" FOREIGN KEY ("admin_users_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_companies_fk" FOREIGN KEY ("companies_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_applications_fk" FOREIGN KEY ("applications_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_general_questions_fk" FOREIGN KEY ("general_questions_id") REFERENCES "public"."general_questions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_detailed_questions_fk" FOREIGN KEY ("detailed_questions_id") REFERENCES "public"."detailed_questions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_survey_submissions_fk" FOREIGN KEY ("survey_submissions_id") REFERENCES "public"."survey_submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_application_evaluations_fk" FOREIGN KEY ("application_evaluations_id") REFERENCES "public"."application_evaluations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_question_responses_fk" FOREIGN KEY ("question_responses_id") REFERENCES "public"."question_responses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_research_results_contacts_fk" FOREIGN KEY ("research_results_contacts_id") REFERENCES "public"."research_results_contacts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_admin_users_fk" FOREIGN KEY ("admin_users_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "admin_users_sessions_order_idx" ON "admin_users_sessions" USING btree ("_order");
  CREATE INDEX "admin_users_sessions_parent_id_idx" ON "admin_users_sessions" USING btree ("_parent_id");
  CREATE INDEX "admin_users_updated_at_idx" ON "admin_users" USING btree ("updated_at");
  CREATE INDEX "admin_users_created_at_idx" ON "admin_users" USING btree ("created_at");
  CREATE UNIQUE INDEX "admin_users_email_idx" ON "admin_users" USING btree ("email");
  CREATE INDEX "companies_updated_at_idx" ON "companies" USING btree ("updated_at");
  CREATE INDEX "companies_created_at_idx" ON "companies" USING btree ("created_at");
  CREATE INDEX "applications_icon_idx" ON "applications" USING btree ("icon_id");
  CREATE INDEX "applications_company_idx" ON "applications" USING btree ("company_id");
  CREATE INDEX "applications_updated_at_idx" ON "applications" USING btree ("updated_at");
  CREATE INDEX "applications_created_at_idx" ON "applications" USING btree ("created_at");
  CREATE UNIQUE INDEX "general_questions_stable_id_idx" ON "general_questions" USING btree ("stable_id");
  CREATE INDEX "general_questions_updated_at_idx" ON "general_questions" USING btree ("updated_at");
  CREATE INDEX "general_questions_created_at_idx" ON "general_questions" USING btree ("created_at");
  CREATE UNIQUE INDEX "detailed_questions_stable_id_idx" ON "detailed_questions" USING btree ("stable_id");
  CREATE INDEX "detailed_questions_updated_at_idx" ON "detailed_questions" USING btree ("updated_at");
  CREATE INDEX "detailed_questions_created_at_idx" ON "detailed_questions" USING btree ("created_at");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "media_sizes_icon_sizes_icon_filename_idx" ON "media" USING btree ("sizes_icon_filename");
  CREATE UNIQUE INDEX "survey_submissions_submission_id_idx" ON "survey_submissions" USING btree ("submission_id");
  CREATE INDEX "survey_submissions_mode_idx" ON "survey_submissions" USING btree ("mode");
  CREATE INDEX "survey_submissions_updated_at_idx" ON "survey_submissions" USING btree ("updated_at");
  CREATE INDEX "survey_submissions_created_at_idx" ON "survey_submissions" USING btree ("created_at");
  CREATE INDEX "application_evaluations_submission_idx" ON "application_evaluations" USING btree ("submission_id");
  CREATE INDEX "application_evaluations_application_idx" ON "application_evaluations" USING btree ("application_id");
  CREATE INDEX "application_evaluations_company_idx" ON "application_evaluations" USING btree ("company_id");
  CREATE INDEX "application_evaluations_updated_at_idx" ON "application_evaluations" USING btree ("updated_at");
  CREATE INDEX "application_evaluations_created_at_idx" ON "application_evaluations" USING btree ("created_at");
  CREATE INDEX "question_responses_evaluation_idx" ON "question_responses" USING btree ("evaluation_id");
  CREATE INDEX "question_responses_updated_at_idx" ON "question_responses" USING btree ("updated_at");
  CREATE INDEX "question_responses_created_at_idx" ON "question_responses" USING btree ("created_at");
  CREATE INDEX "research_results_contacts_submission_idx" ON "research_results_contacts" USING btree ("submission_id");
  CREATE INDEX "research_results_contacts_updated_at_idx" ON "research_results_contacts" USING btree ("updated_at");
  CREATE INDEX "research_results_contacts_created_at_idx" ON "research_results_contacts" USING btree ("created_at");
  CREATE INDEX "exports_updated_at_idx" ON "exports" USING btree ("updated_at");
  CREATE INDEX "exports_created_at_idx" ON "exports" USING btree ("created_at");
  CREATE UNIQUE INDEX "exports_filename_idx" ON "exports" USING btree ("filename");
  CREATE INDEX "exports_texts_order_parent" ON "exports_texts" USING btree ("order","parent_id");
  CREATE INDEX "imports_updated_at_idx" ON "imports" USING btree ("updated_at");
  CREATE INDEX "imports_created_at_idx" ON "imports" USING btree ("created_at");
  CREATE UNIQUE INDEX "imports_filename_idx" ON "imports" USING btree ("filename");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_jobs_log_order_idx" ON "payload_jobs_log" USING btree ("_order");
  CREATE INDEX "payload_jobs_log_parent_id_idx" ON "payload_jobs_log" USING btree ("_parent_id");
  CREATE INDEX "payload_jobs_completed_at_idx" ON "payload_jobs" USING btree ("completed_at");
  CREATE INDEX "payload_jobs_total_tried_idx" ON "payload_jobs" USING btree ("total_tried");
  CREATE INDEX "payload_jobs_has_error_idx" ON "payload_jobs" USING btree ("has_error");
  CREATE INDEX "payload_jobs_task_slug_idx" ON "payload_jobs" USING btree ("task_slug");
  CREATE INDEX "payload_jobs_queue_idx" ON "payload_jobs" USING btree ("queue");
  CREATE INDEX "payload_jobs_wait_until_idx" ON "payload_jobs" USING btree ("wait_until");
  CREATE INDEX "payload_jobs_processing_idx" ON "payload_jobs" USING btree ("processing");
  CREATE INDEX "payload_jobs_updated_at_idx" ON "payload_jobs" USING btree ("updated_at");
  CREATE INDEX "payload_jobs_created_at_idx" ON "payload_jobs" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_admin_users_id_idx" ON "payload_locked_documents_rels" USING btree ("admin_users_id");
  CREATE INDEX "payload_locked_documents_rels_companies_id_idx" ON "payload_locked_documents_rels" USING btree ("companies_id");
  CREATE INDEX "payload_locked_documents_rels_applications_id_idx" ON "payload_locked_documents_rels" USING btree ("applications_id");
  CREATE INDEX "payload_locked_documents_rels_general_questions_id_idx" ON "payload_locked_documents_rels" USING btree ("general_questions_id");
  CREATE INDEX "payload_locked_documents_rels_detailed_questions_id_idx" ON "payload_locked_documents_rels" USING btree ("detailed_questions_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_survey_submissions_id_idx" ON "payload_locked_documents_rels" USING btree ("survey_submissions_id");
  CREATE INDEX "payload_locked_documents_rels_application_evaluations_id_idx" ON "payload_locked_documents_rels" USING btree ("application_evaluations_id");
  CREATE INDEX "payload_locked_documents_rels_question_responses_id_idx" ON "payload_locked_documents_rels" USING btree ("question_responses_id");
  CREATE INDEX "payload_locked_documents_rels_research_results_contacts__idx" ON "payload_locked_documents_rels" USING btree ("research_results_contacts_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_admin_users_id_idx" ON "payload_preferences_rels" USING btree ("admin_users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "admin_users_sessions" CASCADE;
  DROP TABLE "admin_users" CASCADE;
  DROP TABLE "companies" CASCADE;
  DROP TABLE "applications" CASCADE;
  DROP TABLE "general_questions" CASCADE;
  DROP TABLE "detailed_questions" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "survey_submissions" CASCADE;
  DROP TABLE "application_evaluations" CASCADE;
  DROP TABLE "question_responses" CASCADE;
  DROP TABLE "research_results_contacts" CASCADE;
  DROP TABLE "exports" CASCADE;
  DROP TABLE "exports_texts" CASCADE;
  DROP TABLE "imports" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_jobs_log" CASCADE;
  DROP TABLE "payload_jobs" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TABLE "research_settings" CASCADE;
  DROP TYPE "public"."enum_companies_participation_status";
  DROP TYPE "public"."enum_companies_interview_progress";
  DROP TYPE "public"."enum_survey_submissions_background";
  DROP TYPE "public"."enum_survey_submissions_mode";
  DROP TYPE "public"."enum_application_evaluations_mode";
  DROP TYPE "public"."enum_question_responses_status";
  DROP TYPE "public"."enum_exports_format";
  DROP TYPE "public"."enum_exports_sort_order";
  DROP TYPE "public"."enum_exports_drafts";
  DROP TYPE "public"."enum_imports_import_mode";
  DROP TYPE "public"."enum_imports_status";
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  DROP TYPE "public"."enum_payload_jobs_log_state";
  DROP TYPE "public"."enum_payload_jobs_task_slug";`)
}
