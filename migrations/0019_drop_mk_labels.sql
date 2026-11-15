-- Migration number: 0019
-- MK のラベル機能を削除する（UI・API・ドメインと合わせて落とす）。
DROP TABLE IF EXISTS mk_note_labels;
DROP TABLE IF EXISTS mk_labels;
