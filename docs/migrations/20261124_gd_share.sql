-- G$ ecosystem share: each GoodBuilders project's daily share of G$ moved
-- (Admin → Ecosystem, lib/ecosystem/gd-share.ts, cron /api/cron/gd-share).
--
-- A day = Lagos midnight to midnight. For each project we sum the G$ that
-- moved into its contracts from outside and out of them to outside (moves
-- between a project's own contracts are not counted), the transactions and
-- the wallets on the other side. Network totals (all G$ on Celo) per day are
-- kept too, so both "share of the projects" and "share of all G$" show.

create table if not exists public.gd_share_projects (
  name        text        primary key,
  addresses   text[]      not null,
  is_us       boolean     not null default false,
  active      boolean     not null default true,
  sort        int         not null default 0,
  updated_at  timestamptz not null default now()
);

create table if not exists public.gd_share_days (
  day       date    not null,
  project   text    not null,
  g_in      numeric not null default 0,
  g_out     numeric not null default 0,
  volume    numeric not null default 0,
  txs       int     not null default 0,
  wallets   int     not null default 0,
  primary key (day, project)
);

create table if not exists public.gd_share_network (
  day          date        primary key,
  total_g      numeric     not null,
  transfers    int         not null,
  from_block   bigint      not null,
  to_block     bigint      not null,
  complete     boolean     not null default false,  -- false while the day is still running
  computed_at  timestamptz not null default now()
);

alter table public.gd_share_projects enable row level security;
alter table public.gd_share_days enable row level security;
alter table public.gd_share_network enable row level security;

-- The GoodBuilders Season projects (edit from Admin → Ecosystem).
insert into public.gd_share_projects (name, addresses, is_us, sort) values
  ('Delulu', array['0x7692199630F3865160fB1Fa496961251fA15aFEa','0xE652E0cA7DACb6489928C6801D83356a016DcfE1','0xFE5a411b47F88198038EcE3177C19Ea043398c02','0x5548eC3Aa02dCbcE85Cdc6Ad37d61613019D92f8'], true, 0),
  ('GoodCash', array['0x546698368a246539Df5e641EdC2b79c5782ea359','0xA4338586d4B2f0E1641C54b8cF0d53CD06B5c407'], false, 1),
  ('GoodDrops', array['0x261565422E8ec1340F84d3AdadBF4aD5Fc7D5131','0x3835ad1846b196536e1af0504042565CD1911f35','0x4412C27Bb9caae546E71Fc3D4cE7F328F11E6605'], false, 2),
  ('GoodBuildIt', array['0x800a4cb107f788fece1e7fa73aeeec1bce7e8c2f'], false, 3),
  ('UbeGames', array['0x2AF88995303B5e02b705A904e478729CD9ABc319','0x8388DdfD12da76adA04BcF38De85F861fA3FeE54','0x6f874c978f406b4752cEac1F4b9936845E4902Af'], false, 4),
  ('Action Order', array['0x80b10a44b0ea03473707660bc5767099710bbfe0','0x445fce73fa5b87ca9ff84e4fabd27f26aee92cfb','0xc032b8efca84eacfe38a432ac30ca3684854981b','0xb18978895de20bb4c7b79307c0ecbf28744f37c7','0xe9d61b9a0cbb6ef53af1ad63a9e16ca33869f44d','0xba37dd0890afc659a25331871319f66e7eba3522','0x473df985d05a0b635706e58ac8e7452dcc3e9a01','0x8475CA3d129b9d69716b3DCaB73A5e0306EAa9C1','0xbEa347EeBdB3dCb0Bd1feC287561504804f4bA4b'], false, 5),
  ('BlockSlide', array['0xD551317265B9c4D1D453d399D8b8fa0b98D8ceB6'], false, 6),
  ('Jara', array['0x2a13006d33507b0e6eaa49d7ddb5f56fc78da42e'], false, 7),
  ('Onward', array['0x09c44C654653187B480aBDdfdB48AbA11FB38765','0xF66cFE1D3bF53a4Cc9Ced5e9B39945E3769A5c87','0x5B6C4CC464fb14Ed2fa78090924186d5F057875B'], false, 8),
  ('Green Goods', array['0x23F29AF6138F126623bA20b4c051E8a04cC7B9e1','0x166732eD81Ab200A099215cF33F6A712309B69F7','0x0646B09bcf3993F02957651354dC267c450CFE58','0x6BB5b0fd70b6771B0E955Fef37f8Bd2ce911470a','0xB8a7F3c3DfA407c45e05b7B2381233101938a84F','0x67828f64f6D33522679F40D9f1BE1F53c9eb71cB','0xe41a1e446644034f24a4B2E1bfB28Fd414dBc66d','0x1B9Ac97Ea62f69521A14cbe6F45eb24aD6612C19','0x15c8F6CF25abA2161cc04719b4C4a93c4146935D'], false, 9),
  ('LearnIt', array['0x19e3832165e1C7b16b15Bcde31b661EE4aD0c4B9','0xBF55B8bBD6e34aC64BE744CB1679EA2e47A9521d','0x884F4003eB43fc9E882ed957c887990D6b906B45','0x954f4665aEC4075136d31ddAe54b34c9a32F83DF'], false, 10),
  ('Valor', array['0xd4ec6dB553E206cdf741448F94bD3B02D81c8571','0x95D167f569cf05C967C0432e3123baeac5D8d78D','0x3ba09c51895Dacb90273A2A40C95369a5A1b4bFe','0x12a3f711A55f4dB0e9AF26C7429cc5018401F1f4','0xd44D31645e3abBDc48a6Fc5E6E1bCd894db77Ba0'], false, 11)
on conflict (name) do nothing;
