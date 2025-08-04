--
-- PostgreSQL database dump
--

-- Dumped from database version 15.13 (Debian 15.13-1.pgdg120+1)
-- Dumped by pg_dump version 15.13 (Debian 15.13-1.pgdg120+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: specification_status_enum; Type: TYPE; Schema: public; Owner: ph_navigator_user
--

CREATE TYPE public.specification_status_enum AS ENUM (
    'COMPLETE',
    'MISSING',
    'QUESTION',
    'NA'
);


ALTER TYPE public.specification_status_enum OWNER TO ph_navigator_user;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: airtable_bases; Type: TABLE; Schema: public; Owner: ph_navigator_user
--

CREATE TABLE public.airtable_bases (
    id character varying NOT NULL,
    airtable_token character varying
);


ALTER TABLE public.airtable_bases OWNER TO ph_navigator_user;

--
-- Name: airtable_tables; Type: TABLE; Schema: public; Owner: ph_navigator_user
--

CREATE TABLE public.airtable_tables (
    id integer NOT NULL,
    name character varying NOT NULL,
    at_ref character varying NOT NULL,
    parent_base_id character varying NOT NULL
);


ALTER TABLE public.airtable_tables OWNER TO ph_navigator_user;

--
-- Name: airtable_tables_id_seq; Type: SEQUENCE; Schema: public; Owner: ph_navigator_user
--

CREATE SEQUENCE public.airtable_tables_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.airtable_tables_id_seq OWNER TO ph_navigator_user;

--
-- Name: airtable_tables_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ph_navigator_user
--

ALTER SEQUENCE public.airtable_tables_id_seq OWNED BY public.airtable_tables.id;


--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: ph_navigator_user
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


ALTER TABLE public.alembic_version OWNER TO ph_navigator_user;

--
-- Name: assemblies; Type: TABLE; Schema: public; Owner: ph_navigator_user
--

CREATE TABLE public.assemblies (
    id integer NOT NULL,
    name character varying NOT NULL,
    project_id integer NOT NULL,
    orientation character varying NOT NULL
);


ALTER TABLE public.assemblies OWNER TO ph_navigator_user;

--
-- Name: assemblies_id_seq; Type: SEQUENCE; Schema: public; Owner: ph_navigator_user
--

CREATE SEQUENCE public.assemblies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.assemblies_id_seq OWNER TO ph_navigator_user;

--
-- Name: assemblies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ph_navigator_user
--

ALTER SEQUENCE public.assemblies_id_seq OWNED BY public.assemblies.id;


--
-- Name: assembly_layer_segments; Type: TABLE; Schema: public; Owner: ph_navigator_user
--

CREATE TABLE public.assembly_layer_segments (
    id integer NOT NULL,
    layer_id integer NOT NULL,
    material_id character varying NOT NULL,
    "order" integer NOT NULL,
    width_mm double precision NOT NULL,
    steel_stud_spacing_mm double precision,
    is_continuous_insulation boolean NOT NULL,
    specification_status public.specification_status_enum NOT NULL,
    notes text
);


ALTER TABLE public.assembly_layer_segments OWNER TO ph_navigator_user;

--
-- Name: assembly_layer_segments_id_seq; Type: SEQUENCE; Schema: public; Owner: ph_navigator_user
--

CREATE SEQUENCE public.assembly_layer_segments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.assembly_layer_segments_id_seq OWNER TO ph_navigator_user;

--
-- Name: assembly_layer_segments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ph_navigator_user
--

ALTER SEQUENCE public.assembly_layer_segments_id_seq OWNED BY public.assembly_layer_segments.id;


--
-- Name: assembly_layers; Type: TABLE; Schema: public; Owner: ph_navigator_user
--

CREATE TABLE public.assembly_layers (
    id integer NOT NULL,
    "order" integer NOT NULL,
    thickness_mm double precision NOT NULL,
    assembly_id integer NOT NULL
);


ALTER TABLE public.assembly_layers OWNER TO ph_navigator_user;

--
-- Name: assembly_layers_id_seq; Type: SEQUENCE; Schema: public; Owner: ph_navigator_user
--

CREATE SEQUENCE public.assembly_layers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.assembly_layers_id_seq OWNER TO ph_navigator_user;

--
-- Name: assembly_layers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ph_navigator_user
--

ALTER SEQUENCE public.assembly_layers_id_seq OWNED BY public.assembly_layers.id;


--
-- Name: assembly_materials; Type: TABLE; Schema: public; Owner: ph_navigator_user
--

CREATE TABLE public.assembly_materials (
    id character varying NOT NULL,
    name character varying NOT NULL,
    category character varying NOT NULL,
    argb_color character varying,
    conductivity_w_mk double precision,
    emissivity double precision,
    density_kg_m3 double precision,
    specific_heat_j_kgk double precision
);


ALTER TABLE public.assembly_materials OWNER TO ph_navigator_user;

--
-- Name: material_datasheets; Type: TABLE; Schema: public; Owner: ph_navigator_user
--

CREATE TABLE public.material_datasheets (
    id integer NOT NULL,
    segment_id integer NOT NULL,
    full_size_url character varying NOT NULL,
    thumbnail_url character varying NOT NULL,
    content_hash character varying
);


ALTER TABLE public.material_datasheets OWNER TO ph_navigator_user;

--
-- Name: material_datasheets_id_seq; Type: SEQUENCE; Schema: public; Owner: ph_navigator_user
--

CREATE SEQUENCE public.material_datasheets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.material_datasheets_id_seq OWNER TO ph_navigator_user;

--
-- Name: material_datasheets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ph_navigator_user
--

ALTER SEQUENCE public.material_datasheets_id_seq OWNED BY public.material_datasheets.id;


--
-- Name: material_photos; Type: TABLE; Schema: public; Owner: ph_navigator_user
--

CREATE TABLE public.material_photos (
    id integer NOT NULL,
    segment_id integer NOT NULL,
    full_size_url character varying NOT NULL,
    thumbnail_url character varying NOT NULL,
    content_hash character varying
);


ALTER TABLE public.material_photos OWNER TO ph_navigator_user;

--
-- Name: material_photos_id_seq; Type: SEQUENCE; Schema: public; Owner: ph_navigator_user
--

CREATE SEQUENCE public.material_photos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.material_photos_id_seq OWNER TO ph_navigator_user;

--
-- Name: material_photos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ph_navigator_user
--

ALTER SEQUENCE public.material_photos_id_seq OWNED BY public.material_photos.id;


--
-- Name: project_users; Type: TABLE; Schema: public; Owner: ph_navigator_user
--

CREATE TABLE public.project_users (
    project_id integer NOT NULL,
    user_id integer NOT NULL
);


ALTER TABLE public.project_users OWNER TO ph_navigator_user;

--
-- Name: projects; Type: TABLE; Schema: public; Owner: ph_navigator_user
--

CREATE TABLE public.projects (
    id integer NOT NULL,
    name character varying NOT NULL,
    bt_number character varying NOT NULL,
    phius_number character varying,
    phius_dropbox_url character varying,
    owner_id integer NOT NULL,
    airtable_base_id character varying
);


ALTER TABLE public.projects OWNER TO ph_navigator_user;

--
-- Name: projects_id_seq; Type: SEQUENCE; Schema: public; Owner: ph_navigator_user
--

CREATE SEQUENCE public.projects_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.projects_id_seq OWNER TO ph_navigator_user;

--
-- Name: projects_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ph_navigator_user
--

ALTER SEQUENCE public.projects_id_seq OWNED BY public.projects.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: ph_navigator_user
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying NOT NULL,
    email character varying,
    hashed_password character varying NOT NULL
);


ALTER TABLE public.users OWNER TO ph_navigator_user;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: ph_navigator_user
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.users_id_seq OWNER TO ph_navigator_user;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ph_navigator_user
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: airtable_tables id; Type: DEFAULT; Schema: public; Owner: ph_navigator_user
--

ALTER TABLE ONLY public.airtable_tables ALTER COLUMN id SET DEFAULT nextval('public.airtable_tables_id_seq'::regclass);


--
-- Name: assemblies id; Type: DEFAULT; Schema: public; Owner: ph_navigator_user
--

ALTER TABLE ONLY public.assemblies ALTER COLUMN id SET DEFAULT nextval('public.assemblies_id_seq'::regclass);


--
-- Name: assembly_layer_segments id; Type: DEFAULT; Schema: public; Owner: ph_navigator_user
--

ALTER TABLE ONLY public.assembly_layer_segments ALTER COLUMN id SET DEFAULT nextval('public.assembly_layer_segments_id_seq'::regclass);


--
-- Name: assembly_layers id; Type: DEFAULT; Schema: public; Owner: ph_navigator_user
--

ALTER TABLE ONLY public.assembly_layers ALTER COLUMN id SET DEFAULT nextval('public.assembly_layers_id_seq'::regclass);


--
-- Name: material_datasheets id; Type: DEFAULT; Schema: public; Owner: ph_navigator_user
--

ALTER TABLE ONLY public.material_datasheets ALTER COLUMN id SET DEFAULT nextval('public.material_datasheets_id_seq'::regclass);


--
-- Name: material_photos id; Type: DEFAULT; Schema: public; Owner: ph_navigator_user
--

ALTER TABLE ONLY public.material_photos ALTER COLUMN id SET DEFAULT nextval('public.material_photos_id_seq'::regclass);


--
-- Name: projects id; Type: DEFAULT; Schema: public; Owner: ph_navigator_user
--

ALTER TABLE ONLY public.projects ALTER COLUMN id SET DEFAULT nextval('public.projects_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: ph_navigator_user
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: airtable_bases; Type: TABLE DATA; Schema: public; Owner: ph_navigator_user
--

COPY public.airtable_bases (id, airtable_token) FROM stdin;
app64a1JuYVBs7Z1m	gAAAAABoZUzaAInJ1qnFlbwxLyUUzxgsWgRJY12BJEXmzBVIvBRXtUaN4N8KAT1kVz3b2apyPVk4WGbChWfuMS9A1nTYhgRZmRUYg_vFKI9B6Gnj4LqbLYaRSpol3Fsh-6BUzGkQ4CBMcwGjINvNPKMEmBVCilEWMNzQX-6xJ_XB2OaLsgau2f2UOuajyONqoyyZYLmTOfK_
app2huKgwyKrnMRbp	gAAAAABoZUzaIWD_Vw_hmRMGbj_7UTqgrBVN0kcRVu1TE7NZ3wzsmDtU4Spc_YLh0phzUyhGsHS7Nqrwfc_xH16WORV_1FhA5OBnyyjT6cOox_hA9m8zeQ9zDqJixirOAE1dE8gXDB8HToC6QIRGXAxRCLmQRAJNVKzktRLLOkDGQrTf2DeWPDH46q1NuAZO4fYqEeJ8LeVT
appMJvv2qkl5eZ1S0	gAAAAABoZUzaQPFwyeO2pqmKYZ4aUK6xizD0lXZ8i_fUv6Ru7naM9f11qvcpq8vvrDtZWBepqAaMGsaIERhcG0816IRLFi3j6rC0W18e_cSu1UGaMzGrJ2KE4kCIC34x_y0i4X3GGdkteGu1R6nsmh2Z3XER-XRaujJeBVgIBv7gR8Dp9Vcn-SdlbNJ2Nh-q8QjTI1GbfLVz
\.


--
-- Data for Name: airtable_tables; Type: TABLE DATA; Schema: public; Owner: ph_navigator_user
--

COPY public.airtable_tables (id, name, at_ref, parent_base_id) FROM stdin;
1	SUMMARY	tblapLjAFgm7RIllz	app64a1JuYVBs7Z1m
2	CONFIG	tblRMar5uK7mDZ8yM	app64a1JuYVBs7Z1m
3	FANS	tbldbadmmNca7E1Nr	app64a1JuYVBs7Z1m
4	PUMPS	tbliRO0hZim8oQ2qw	app64a1JuYVBs7Z1m
5	ERV_UNITS	tblkIaP1TspndVI5f	app64a1JuYVBs7Z1m
6	DHW_TANKS	tbl3EYwyh6HhmlbqP	app64a1JuYVBs7Z1m
7	LIGHTING_FIXTURES	tblkLN5vn6fcXnTRT	app64a1JuYVBs7Z1m
8	APPLIANCES	tblqfzzcqc3o2IcD4	app64a1JuYVBs7Z1m
9	WINDOW_GLAZING_TYPES	tbl3JAeRMqiloWQ65	app64a1JuYVBs7Z1m
10	WINDOW_FRAME_TYPES	tblejOjMq62zdRT3D	app64a1JuYVBs7Z1m
11	WINDOW_UNITS	tblGOpIen7MnCuQRe	app64a1JuYVBs7Z1m
12	MATERIAL_LAYERS	tblkWxg3xXMjzjO32	app64a1JuYVBs7Z1m
13	HBJSON	tbllXDdHXDwMxeb30	app64a1JuYVBs7Z1m
14	SUMMARY	tblb8D5jcw1KyB522	app2huKgwyKrnMRbp
15	CONFIG	tblOPg6rOq7Uy2zJT	app2huKgwyKrnMRbp
16	FANS	tblCwWhH3YuNV34ec	app2huKgwyKrnMRbp
17	PUMPS	tbl3F59OhLXcgaWm0	app2huKgwyKrnMRbp
18	ERV_UNITS	tblQtcVgB6iYbyhis	app2huKgwyKrnMRbp
19	DHW_TANKS	tblPPiCNkZE1s5NgW	app2huKgwyKrnMRbp
20	LIGHTING_FIXTURES	tblRH6A9tLyKGsUD0	app2huKgwyKrnMRbp
21	APPLIANCES	tblgk5pneolD192Dv	app2huKgwyKrnMRbp
22	WINDOW_GLAZING_TYPES	tblbreMnmdsKDCYTN	app2huKgwyKrnMRbp
23	WINDOW_FRAME_TYPES	tblJm0uhhChDY0jKQ	app2huKgwyKrnMRbp
24	WINDOW_UNITS	tbln2qVrxqSNlAJOK	app2huKgwyKrnMRbp
25	MATERIAL_LAYERS	tblaqehqmP6xfOPUP	app2huKgwyKrnMRbp
26	HBJSON	tblyXNYA0z8OiZQ2a	app2huKgwyKrnMRbp
27	SUMMARY	tblTWt78WrqpxvseQ	appMJvv2qkl5eZ1S0
28	CONFIG	tblqXGps9noqY0LqZ	appMJvv2qkl5eZ1S0
29	FANS	tblmYX2tXK5rMgeVN	appMJvv2qkl5eZ1S0
30	PUMPS	tblhCV9mCZpmsfzqb	appMJvv2qkl5eZ1S0
31	ERV_UNITS	tblAVdG2vSTC2LrZ3	appMJvv2qkl5eZ1S0
32	DHW_TANKS	tbl3tJSHXY6zbqFyn	appMJvv2qkl5eZ1S0
33	LIGHTING_FIXTURES	tbloPDsPtkyCa17Vs	appMJvv2qkl5eZ1S0
34	APPLIANCES	tbl0M6a98aWhSmck6	appMJvv2qkl5eZ1S0
35	WINDOW_GLAZING_TYPES	tblBrale1asxtzuNo	appMJvv2qkl5eZ1S0
36	WINDOW_FRAME_TYPES	tblgfvZKVLArxhyTC	appMJvv2qkl5eZ1S0
37	WINDOW_UNITS	tbl47pEy8yTM3rwdC	appMJvv2qkl5eZ1S0
38	MATERIAL_LAYERS	tblUSf2cgBHb61ZBq	appMJvv2qkl5eZ1S0
\.


--
-- Data for Name: alembic_version; Type: TABLE DATA; Schema: public; Owner: ph_navigator_user
--

COPY public.alembic_version (version_num) FROM stdin;
ac7703c5800f
\.


--
-- Data for Name: assemblies; Type: TABLE DATA; Schema: public; Owner: ph_navigator_user
--

COPY public.assemblies (id, name, project_id, orientation) FROM stdin;
1	__test_assembly__	1	first_layer_outside
\.


--
-- Data for Name: assembly_layer_segments; Type: TABLE DATA; Schema: public; Owner: ph_navigator_user
--

COPY public.assembly_layer_segments (id, layer_id, material_id, "order", width_mm, steel_stud_spacing_mm, is_continuous_insulation, specification_status, notes) FROM stdin;
1	1	mat1	0	200	200	f	COMPLETE	A test note
2	1	mat2	1	100	\N	f	MISSING	Another test note
3	2	mat3	0	300	\N	f	NA	\N
\.


--
-- Data for Name: assembly_layers; Type: TABLE DATA; Schema: public; Owner: ph_navigator_user
--

COPY public.assembly_layers (id, "order", thickness_mm, assembly_id) FROM stdin;
1	0	50	1
2	1	100	1
\.


--
-- Data for Name: assembly_materials; Type: TABLE DATA; Schema: public; Owner: ph_navigator_user
--

COPY public.assembly_materials (id, name, category, argb_color, conductivity_w_mk, emissivity, density_kg_m3, specific_heat_j_kgk) FROM stdin;
mat1	Test Material 1	Category-A	(255, 255, 255, 255)	1	0.9	999	999
mat2	Test Material 2	Category-B	(255, 255, 255, 255)	2	0.9	999	999
mat3	Test Material 3	Category-B	(255, 255, 255, 255)	3	0.9	999	999
\.


--
-- Data for Name: material_datasheets; Type: TABLE DATA; Schema: public; Owner: ph_navigator_user
--

COPY public.material_datasheets (id, segment_id, full_size_url, thumbnail_url, content_hash) FROM stdin;
\.


--
-- Data for Name: material_photos; Type: TABLE DATA; Schema: public; Owner: ph_navigator_user
--

COPY public.material_photos (id, segment_id, full_size_url, thumbnail_url, content_hash) FROM stdin;
\.


--
-- Data for Name: project_users; Type: TABLE DATA; Schema: public; Owner: ph_navigator_user
--

COPY public.project_users (project_id, user_id) FROM stdin;
1	1
1	2
1	3
2	1
2	2
2	3
3	1
3	2
3	3
\.


--
-- Data for Name: projects; Type: TABLE DATA; Schema: public; Owner: ph_navigator_user
--

COPY public.projects (id, name, bt_number, phius_number, phius_dropbox_url, owner_id, airtable_base_id) FROM stdin;
1	409 SACKETT ST	2305	2445	https://www.dropbox.com/scl/fo/wqjaevwa95qaoij71bw89/h?rlkey=nwbwyt67ou62c6ir36zsjkodz&dl=0	1	app64a1JuYVBs7Z1m
2	ARVERNE ST	2242	2441	https://www.dropbox.com/scl/fo/5b2w4n9wc1psda63xso4m/h?rlkey=e5c4bvo1visbecr0uea9lt0r3&dl=0	2	app2huKgwyKrnMRbp
3	ALPINE ST	2141	2628	https://www.dropbox.com/scl/fo/wqjaevwa95qaoij71bw89/h?rlkey=nwbwyt67ou62c6ir36zsjkodz&dl=0	3	appMJvv2qkl5eZ1S0
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: ph_navigator_user
--

COPY public.users (id, username, email, hashed_password) FROM stdin;
1	user1	user1@email.com	$2b$12$6D5QkaA6ltumCRCI0ywaOuJVLGOo0u/ERw9rbW1K/p9UgGT8Jka7S
2	user2	user2@email.com	$2b$12$lp2YdTuZBrvHhvHDpxh1YeLIgSfQu1JhQz5qDPwnr3JheFOQheJsu
3	user3	user3@email.com	$2b$12$gwxTRWlsFF4IU2XiOnTpL./1HZ4GOkxdP5UhSxYTksfd4f30bWpwO
\.


--
-- Name: airtable_tables_id_seq; Type: SEQUENCE SET; Schema: public; Owner: ph_navigator_user
--

SELECT pg_catalog.setval('public.airtable_tables_id_seq', 38, true);


--
-- Name: assemblies_id_seq; Type: SEQUENCE SET; Schema: public; Owner: ph_navigator_user
--

SELECT pg_catalog.setval('public.assemblies_id_seq', 1, true);


--
-- Name: assembly_layer_segments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: ph_navigator_user
--

SELECT pg_catalog.setval('public.assembly_layer_segments_id_seq', 3, true);


--
-- Name: assembly_layers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: ph_navigator_user
--

SELECT pg_catalog.setval('public.assembly_layers_id_seq', 2, true);


--
-- Name: material_datasheets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: ph_navigator_user
--

SELECT pg_catalog.setval('public.material_datasheets_id_seq', 1, false);


--
-- Name: material_photos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: ph_navigator_user
--

SELECT pg_catalog.setval('public.material_photos_id_seq', 1, false);


--
-- Name: projects_id_seq; Type: SEQUENCE SET; Schema: public; Owner: ph_navigator_user
--

SELECT pg_catalog.setval('public.projects_id_seq', 3, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: ph_navigator_user
--

SELECT pg_catalog.setval('public.users_id_seq', 3, true);


--
-- Name: airtable_bases airtable_bases_pkey; Type: CONSTRAINT; Schema: public; Owner: ph_navigator_user
--

ALTER TABLE ONLY public.airtable_bases
    ADD CONSTRAINT airtable_bases_pkey PRIMARY KEY (id);


--
-- Name: airtable_tables airtable_tables_pkey; Type: CONSTRAINT; Schema: public; Owner: ph_navigator_user
--

ALTER TABLE ONLY public.airtable_tables
    ADD CONSTRAINT airtable_tables_pkey PRIMARY KEY (id);


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: ph_navigator_user
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: assemblies assemblies_pkey; Type: CONSTRAINT; Schema: public; Owner: ph_navigator_user
--

ALTER TABLE ONLY public.assemblies
    ADD CONSTRAINT assemblies_pkey PRIMARY KEY (id);


--
-- Name: assembly_layer_segments assembly_layer_segments_pkey; Type: CONSTRAINT; Schema: public; Owner: ph_navigator_user
--

ALTER TABLE ONLY public.assembly_layer_segments
    ADD CONSTRAINT assembly_layer_segments_pkey PRIMARY KEY (id);


--
-- Name: assembly_layers assembly_layers_pkey; Type: CONSTRAINT; Schema: public; Owner: ph_navigator_user
--

ALTER TABLE ONLY public.assembly_layers
    ADD CONSTRAINT assembly_layers_pkey PRIMARY KEY (id);


--
-- Name: assembly_materials assembly_materials_pkey; Type: CONSTRAINT; Schema: public; Owner: ph_navigator_user
--

ALTER TABLE ONLY public.assembly_materials
    ADD CONSTRAINT assembly_materials_pkey PRIMARY KEY (id);


--
-- Name: material_datasheets material_datasheets_pkey; Type: CONSTRAINT; Schema: public; Owner: ph_navigator_user
--

ALTER TABLE ONLY public.material_datasheets
    ADD CONSTRAINT material_datasheets_pkey PRIMARY KEY (id);


--
-- Name: material_photos material_photos_pkey; Type: CONSTRAINT; Schema: public; Owner: ph_navigator_user
--

ALTER TABLE ONLY public.material_photos
    ADD CONSTRAINT material_photos_pkey PRIMARY KEY (id);


--
-- Name: project_users project_users_pkey; Type: CONSTRAINT; Schema: public; Owner: ph_navigator_user
--

ALTER TABLE ONLY public.project_users
    ADD CONSTRAINT project_users_pkey PRIMARY KEY (project_id, user_id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: ph_navigator_user
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: ph_navigator_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: ix_airtable_bases_id; Type: INDEX; Schema: public; Owner: ph_navigator_user
--

CREATE INDEX ix_airtable_bases_id ON public.airtable_bases USING btree (id);


--
-- Name: ix_airtable_tables_at_ref; Type: INDEX; Schema: public; Owner: ph_navigator_user
--

CREATE INDEX ix_airtable_tables_at_ref ON public.airtable_tables USING btree (at_ref);


--
-- Name: ix_airtable_tables_id; Type: INDEX; Schema: public; Owner: ph_navigator_user
--

CREATE INDEX ix_airtable_tables_id ON public.airtable_tables USING btree (id);


--
-- Name: ix_airtable_tables_name; Type: INDEX; Schema: public; Owner: ph_navigator_user
--

CREATE INDEX ix_airtable_tables_name ON public.airtable_tables USING btree (name);


--
-- Name: ix_assembly_layers_id; Type: INDEX; Schema: public; Owner: ph_navigator_user
--

CREATE INDEX ix_assembly_layers_id ON public.assembly_layers USING btree (id);


--
-- Name: ix_assembly_materials_id; Type: INDEX; Schema: public; Owner: ph_navigator_user
--

CREATE INDEX ix_assembly_materials_id ON public.assembly_materials USING btree (id);


--
-- Name: ix_material_datasheets_content_hash; Type: INDEX; Schema: public; Owner: ph_navigator_user
--

CREATE INDEX ix_material_datasheets_content_hash ON public.material_datasheets USING btree (content_hash);


--
-- Name: ix_material_photos_content_hash; Type: INDEX; Schema: public; Owner: ph_navigator_user
--

CREATE INDEX ix_material_photos_content_hash ON public.material_photos USING btree (content_hash);


--
-- Name: ix_projects_bt_number; Type: INDEX; Schema: public; Owner: ph_navigator_user
--

CREATE INDEX ix_projects_bt_number ON public.projects USING btree (bt_number);


--
-- Name: ix_projects_id; Type: INDEX; Schema: public; Owner: ph_navigator_user
--

CREATE INDEX ix_projects_id ON public.projects USING btree (id);


--
-- Name: ix_projects_name; Type: INDEX; Schema: public; Owner: ph_navigator_user
--

CREATE INDEX ix_projects_name ON public.projects USING btree (name);


--
-- Name: ix_projects_phius_dropbox_url; Type: INDEX; Schema: public; Owner: ph_navigator_user
--

CREATE INDEX ix_projects_phius_dropbox_url ON public.projects USING btree (phius_dropbox_url);


--
-- Name: ix_projects_phius_number; Type: INDEX; Schema: public; Owner: ph_navigator_user
--

CREATE INDEX ix_projects_phius_number ON public.projects USING btree (phius_number);


--
-- Name: ix_users_email; Type: INDEX; Schema: public; Owner: ph_navigator_user
--

CREATE UNIQUE INDEX ix_users_email ON public.users USING btree (email);


--
-- Name: ix_users_id; Type: INDEX; Schema: public; Owner: ph_navigator_user
--

CREATE INDEX ix_users_id ON public.users USING btree (id);


--
-- Name: ix_users_username; Type: INDEX; Schema: public; Owner: ph_navigator_user
--

CREATE UNIQUE INDEX ix_users_username ON public.users USING btree (username);


--
-- Name: airtable_tables airtable_tables_parent_base_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ph_navigator_user
--

ALTER TABLE ONLY public.airtable_tables
    ADD CONSTRAINT airtable_tables_parent_base_id_fkey FOREIGN KEY (parent_base_id) REFERENCES public.airtable_bases(id);


--
-- Name: assemblies assemblies_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ph_navigator_user
--

ALTER TABLE ONLY public.assemblies
    ADD CONSTRAINT assemblies_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: assembly_layer_segments assembly_layer_segments_layer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ph_navigator_user
--

ALTER TABLE ONLY public.assembly_layer_segments
    ADD CONSTRAINT assembly_layer_segments_layer_id_fkey FOREIGN KEY (layer_id) REFERENCES public.assembly_layers(id);


--
-- Name: assembly_layer_segments assembly_layer_segments_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ph_navigator_user
--

ALTER TABLE ONLY public.assembly_layer_segments
    ADD CONSTRAINT assembly_layer_segments_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.assembly_materials(id);


--
-- Name: assembly_layers assembly_layers_assembly_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ph_navigator_user
--

ALTER TABLE ONLY public.assembly_layers
    ADD CONSTRAINT assembly_layers_assembly_id_fkey FOREIGN KEY (assembly_id) REFERENCES public.assemblies(id);


--
-- Name: material_datasheets material_datasheets_segment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ph_navigator_user
--

ALTER TABLE ONLY public.material_datasheets
    ADD CONSTRAINT material_datasheets_segment_id_fkey FOREIGN KEY (segment_id) REFERENCES public.assembly_layer_segments(id);


--
-- Name: material_photos material_photos_segment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ph_navigator_user
--

ALTER TABLE ONLY public.material_photos
    ADD CONSTRAINT material_photos_segment_id_fkey FOREIGN KEY (segment_id) REFERENCES public.assembly_layer_segments(id);


--
-- Name: project_users project_users_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ph_navigator_user
--

ALTER TABLE ONLY public.project_users
    ADD CONSTRAINT project_users_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: project_users project_users_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ph_navigator_user
--

ALTER TABLE ONLY public.project_users
    ADD CONSTRAINT project_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: projects projects_airtable_base_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ph_navigator_user
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_airtable_base_id_fkey FOREIGN KEY (airtable_base_id) REFERENCES public.airtable_bases(id);


--
-- Name: projects projects_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ph_navigator_user
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

