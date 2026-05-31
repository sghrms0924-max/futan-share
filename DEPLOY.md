# VercelでiPhoneから見られるようにする

このアプリは `index.html` だけで動く静的サイトなので、Vercelに置けばiPhoneのSafariからURLを開けます。

## いちばん簡単な方法

1. このフォルダをGitHubのリポジトリに入れる。
2. Vercelで「Add New Project」を選ぶ。
3. GitHubリポジトリを選んでImportする。
4. Framework Presetは `Other` のままでOK。
5. Build Commandは空、Output Directoryも空のままでDeployする。
6. 発行された `https://...vercel.app` のURLをiPhoneで開く。

同期機能を使う場合は、`api/sync.js` も一緒にアップロードしてください。

## コマンドで公開する方法

このフォルダで以下を実行します。

```sh
npx vercel
```

初回はVercelへのログインを求められます。公開設定は基本的にデフォルトでOKです。

本番URLに反映する時は以下です。

```sh
npx vercel --prod
```

## iPhoneでアプリっぽく使う

1. iPhoneのSafariでVercelのURLを開く。
2. 共有ボタンを押す。
3. 「ホーム画面に追加」を選ぶ。

## 注意

今の保存機能はブラウザ内保存です。Macで保存した履歴はiPhoneには自動同期されません。同期したい場合は、SupabaseやFirebaseなどの保存先を追加する必要があります。

## SupabaseでMacとiPhoneを同期する

Supabaseを使う場合は、SQL Editorで `supabase.sql` の内容を実行します。中身は以下です。

```sql
create table if not exists household_states (
  household_id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table household_states enable row level security;

drop policy if exists "allow household app read" on household_states;
drop policy if exists "allow household app insert" on household_states;
drop policy if exists "allow household app update" on household_states;

create or replace function get_household_state(p_household_id text)
returns table(data jsonb, updated_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select household_states.data, household_states.updated_at
  from household_states
  where household_states.household_id = p_household_id
  limit 1;
$$;

create or replace function save_household_state(
  p_household_id text,
  p_data jsonb,
  p_updated_at timestamptz
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into household_states (household_id, data, updated_at)
  values (p_household_id, p_data, p_updated_at)
  on conflict (household_id) do update
  set data = excluded.data,
      updated_at = excluded.updated_at;
$$;

grant execute on function get_household_state(text) to anon;
grant execute on function save_household_state(text, jsonb, timestamptz) to anon;
```

そのあとアプリの「同期」タブに以下を入れます。

- Supabase URL: Project Settings > API の Project URL
- Publishable key: Project Settings > API Keys の Publishable key
- 共有ID: 夫婦だけで使う長めの文字列

共有IDはパスワード代わりになるので、推測されにくいものにしてください。例: `family-share-2026-random-text`
