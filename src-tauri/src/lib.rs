use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_initial_tables",
            sql: "
                CREATE TABLE IF NOT EXISTS sites (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE,
                    location TEXT,
                    is_active BOOLEAN NOT NULL DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS reagents (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE,
                    description TEXT
                );

                CREATE TABLE IF NOT EXISTS lots (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    lot_number TEXT NOT NULL UNIQUE,
                    reagent_id INTEGER NOT NULL,
                    expiration_date DATE NOT NULL,
                    total_quantity INTEGER NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (reagent_id) REFERENCES reagents (id)
                );

                CREATE TABLE IF NOT EXISTS shipments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    lot_id INTEGER NOT NULL,
                    site_id INTEGER NOT NULL,
                    quantity INTEGER NOT NULL,
                    shipped_date DATE NOT NULL,
                    received_date DATE,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (lot_id) REFERENCES lots (id),
                    FOREIGN KEY (site_id) REFERENCES sites (id)
                );

                CREATE TABLE IF NOT EXISTS transfers (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    lot_id INTEGER NOT NULL,
                    from_site_id INTEGER NOT NULL,
                    to_site_id INTEGER NOT NULL,
                    quantity INTEGER NOT NULL,
                    transfer_date DATE NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (lot_id) REFERENCES lots (id),
                    FOREIGN KEY (from_site_id) REFERENCES sites (id),
                    FOREIGN KEY (to_site_id) REFERENCES sites (id)
                );

                CREATE TABLE IF NOT EXISTS inventory_records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    lot_id INTEGER NOT NULL,
                    site_id INTEGER NOT NULL,
                    quantity_on_hand INTEGER NOT NULL,
                    recorded_date DATE NOT NULL,
                    recorded_by TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (lot_id) REFERENCES lots (id),
                    FOREIGN KEY (site_id) REFERENCES sites (id)
                );

                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT NOT NULL UNIQUE,
                    email TEXT NOT NULL UNIQUE,
                    name TEXT NOT NULL,
                    role TEXT NOT NULL DEFAULT 'USER',
                    is_active BOOLEAN NOT NULL DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );
            ",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "remove_total_quantity_from_lots",
            sql: "ALTER TABLE lots DROP COLUMN total_quantity;",
            kind: MigrationKind::Up,
        }
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:inventory.db", migrations)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
