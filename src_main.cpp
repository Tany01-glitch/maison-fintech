#include "httplib.h"
#include "json.hpp"
#include <sqlite3.h>

#include <algorithm>
#include <cctype>
#include <cstdlib>
#include <filesystem>
#include <iostream>
#include <string>

using json = nlohmann::json;
namespace fs = std::filesystem;

static sqlite3* db = nullptr;

static std::string env_or(const char* key, const std::string& fallback) {
    const char* value = std::getenv(key);
    return value ? value : fallback;
}

static bool execute_sql(const std::string& sql) {
    char* err = nullptr;
    int rc = sqlite3_exec(db, sql.c_str(), nullptr, nullptr, &err);
    if (rc != SQLITE_OK) {
        std::cerr << "SQLite error: " << (err ? err : "unknown") << '\n';
        sqlite3_free(err);
        return false;
    }
    return true;
}

static void initialize_database() {
    execute_sql(R"SQL(
      CREATE TABLE IF NOT EXISTS budgets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        month TEXT NOT NULL,
        income REAL NOT NULL DEFAULT 0,
        needs REAL NOT NULL DEFAULT 0,
        wants REAL NOT NULL DEFAULT 0,
        debt REAL NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_budgets_month ON budgets(month);
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        amount REAL NOT NULL,
        kind TEXT NOT NULL CHECK(kind IN ('income','expense')),
        date TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
      CREATE TABLE IF NOT EXISTS goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        target REAL NOT NULL,
        saved REAL NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    )SQL");
}

static json error_json(const std::string& message) {
    return json{{"ok", false}, {"error", message}};
}

static bool has_string(const json& j, const char* key) {
    return j.contains(key) && j[key].is_string();
}

static bool get_number(const json& j, const char* key, double& value) {
    if (!j.contains(key) || (!j[key].is_number() && !j[key].is_string())) return false;
    try {
        if (j[key].is_number()) value = j[key].get<double>();
        else value = std::stod(j[key].get<std::string>());
        return true;
    } catch (...) { return false; }
}

static std::string get_string(const json& j, const char* key, const std::string& fallback = "") {
    return has_string(j, key) ? j[key].get<std::string>() : fallback;
}

static bool valid_month(const std::string& month) {
    if (month.size() != 7 || month[4] != '-') return false;
    for (int i = 0; i < 7; ++i) if (i != 4 && !std::isdigit(static_cast<unsigned char>(month[i]))) return false;
    int m = std::stoi(month.substr(5, 2));
    return m >= 1 && m <= 12;
}

static bool valid_date(const std::string& date) {
    if (date.size() != 10 || date[4] != '-' || date[7] != '-') return false;
    for (int i = 0; i < 10; ++i)
        if (i != 4 && i != 7 && !std::isdigit(static_cast<unsigned char>(date[i]))) return false;
    int month = std::stoi(date.substr(5, 2)), day = std::stoi(date.substr(8, 2));
    return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

static json dashboard(const std::string& month) {
    json result;
    result["ok"] = true;
    result["month"] = month;
    result["budget"] = nullptr;
    result["totals"] = {{"income", 0.0}, {"expenses", 0.0}, {"balance", 0.0}};
    result["transactions"] = json::array();
    result["goals"] = json::array();

    sqlite3_stmt* stmt = nullptr;
    const char* budget_sql = "SELECT income,needs,wants,debt FROM budgets WHERE month=? ORDER BY id DESC LIMIT 1";
    if (sqlite3_prepare_v2(db, budget_sql, -1, &stmt, nullptr) == SQLITE_OK) {
        sqlite3_bind_text(stmt, 1, month.c_str(), -1, SQLITE_TRANSIENT);
        if (sqlite3_step(stmt) == SQLITE_ROW) {
            double income = sqlite3_column_double(stmt, 0);
            double needs = sqlite3_column_double(stmt, 1);
            double wants = sqlite3_column_double(stmt, 2);
            double debt = sqlite3_column_double(stmt, 3);
            result["budget"] = {{"income", income}, {"needs", needs}, {"wants", wants},
                                {"debt", debt}, {"savings", income-needs-wants-debt}};
        }
    }
    sqlite3_finalize(stmt);

    const char* totals_sql =
        "SELECT kind, COALESCE(SUM(amount),0) FROM transactions WHERE substr(date,1,7)=? GROUP BY kind";
    if (sqlite3_prepare_v2(db, totals_sql, -1, &stmt, nullptr) == SQLITE_OK) {
        sqlite3_bind_text(stmt, 1, month.c_str(), -1, SQLITE_TRANSIENT);
        while (sqlite3_step(stmt) == SQLITE_ROW) {
            std::string kind = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 0));
            double amount = sqlite3_column_double(stmt, 1);
            if (kind == "income") result["totals"]["income"] = amount;
            else result["totals"]["expenses"] = amount;
        }
    }
    sqlite3_finalize(stmt);
    result["totals"]["balance"] = result["totals"]["income"].get<double>() -
                                    result["totals"]["expenses"].get<double>();

    const char* tx_sql = "SELECT id,title,category,amount,kind,date FROM transactions "
                         "WHERE substr(date,1,7)=? ORDER BY date DESC,id DESC LIMIT 8";
    if (sqlite3_prepare_v2(db, tx_sql, -1, &stmt, nullptr) == SQLITE_OK) {
        sqlite3_bind_text(stmt, 1, month.c_str(), -1, SQLITE_TRANSIENT);
        while (sqlite3_step(stmt) == SQLITE_ROW) {
            result["transactions"].push_back({
                {"id", sqlite3_column_int(stmt, 0)},
                {"title", reinterpret_cast<const char*>(sqlite3_column_text(stmt, 1))},
                {"category", reinterpret_cast<const char*>(sqlite3_column_text(stmt, 2))},
                {"amount", sqlite3_column_double(stmt, 3)},
                {"kind", reinterpret_cast<const char*>(sqlite3_column_text(stmt, 4))},
                {"date", reinterpret_cast<const char*>(sqlite3_column_text(stmt, 5))}
            });
        }
    }
    sqlite3_finalize(stmt);

    const char* goals_sql = "SELECT id,title,target,saved FROM goals ORDER BY id DESC";
    if (sqlite3_prepare_v2(db, goals_sql, -1, &stmt, nullptr) == SQLITE_OK) {
        while (sqlite3_step(stmt) == SQLITE_ROW) {
            double target = sqlite3_column_double(stmt, 2);
            double saved = sqlite3_column_double(stmt, 3);
            double progress = target > 0 ? std::min(100.0, saved / target * 100.0) : 0.0;
            result["goals"].push_back({
                {"id", sqlite3_column_int(stmt, 0)},
                {"title", reinterpret_cast<const char*>(sqlite3_column_text(stmt, 1))},
                {"target", target}, {"saved", saved}, {"progress", progress}
            });
        }
    }
    sqlite3_finalize(stmt);
    return result;
}

int main() {
    const std::string db_path = env_or("MAISON_DB_PATH", "instance/maison_money.db");
    const fs::path database_file(db_path);
    if (!database_file.parent_path().empty()) fs::create_directories(database_file.parent_path());

    if (sqlite3_open(db_path.c_str(), &db) != SQLITE_OK) {
        std::cerr << "Could not open SQLite database: " << sqlite3_errmsg(db) << '\n';
        return 1;
    }
    initialize_database();

    httplib::Server server;
    server.set_mount_point("/static", "./static");

    server.Get("/", [](const httplib::Request&, httplib::Response& res) {
        res.set_file_content("./templates/index.html", "text/html; charset=utf-8");
    });

    server.Get("/api/dashboard", [](const httplib::Request& req, httplib::Response& res) {
        std::string month = req.has_param("month") ? req.get_param_value("month") : "2026-11";
        if (!valid_month(month)) {
            res.status = 400; res.set_content(error_json("Choose a valid month.").dump(), "application/json"); return;
        }
        res.set_content(dashboard(month).dump(), "application/json");
    });

    server.Post("/api/budget", [](const httplib::Request& req, httplib::Response& res) {
        json data = json::parse(req.body, nullptr, false);
        if (data.is_discarded()) { res.status=400; res.set_content(error_json("Invalid JSON.").dump(),"application/json"); return; }
        std::string month = get_string(data, "month");
        if (!valid_month(month)) { res.status=400; res.set_content(error_json("Choose a valid month.").dump(),"application/json"); return; }
        double income, needs, wants, debt;
        if (!get_number(data,"income",income)||!get_number(data,"needs",needs)||
            !get_number(data,"wants",wants)||!get_number(data,"debt",debt)) {
            res.status=400; res.set_content(error_json("Budget values must be numbers.").dump(),"application/json"); return;
        }
        if (income<0||needs<0||wants<0||debt<0) { res.status=400; res.set_content(error_json("Amounts cannot be negative.").dump(),"application/json"); return; }
        sqlite3_stmt* stmt=nullptr;
        const char* sql="INSERT INTO budgets(month,income,needs,wants,debt) VALUES(?,?,?,?,?)";
        if(sqlite3_prepare_v2(db,sql,-1,&stmt,nullptr)!=SQLITE_OK){res.status=500;res.set_content(error_json("Database error.").dump(),"application/json");return;}
        sqlite3_bind_text(stmt,1,month.c_str(),-1,SQLITE_TRANSIENT);
        sqlite3_bind_double(stmt,2,income);sqlite3_bind_double(stmt,3,needs);sqlite3_bind_double(stmt,4,wants);sqlite3_bind_double(stmt,5,debt);
        bool ok=sqlite3_step(stmt)==SQLITE_DONE;sqlite3_finalize(stmt);
        if(!ok){res.status=500;res.set_content(error_json("Could not save budget.").dump(),"application/json");return;}
        res.set_content(json{{"ok",true},{"message","Budget saved."},{"savings",income-needs-wants-debt}}.dump(),"application/json");
    });

    server.Post("/api/transactions", [](const httplib::Request& req, httplib::Response& res) {
        json d=json::parse(req.body,nullptr,false);
        if(d.is_discarded()){res.status=400;res.set_content(error_json("Invalid JSON.").dump(),"application/json");return;}
        std::string title=get_string(d,"title"),category=get_string(d,"category","Other"),kind=get_string(d,"kind"),date=get_string(d,"date");
        double amount;
        if(title.empty()||title.size()>100){res.status=400;res.set_content(error_json("Title is required (maximum 100 characters).").dump(),"application/json");return;}
        if(!get_number(d,"amount",amount)||amount<=0||(kind!="income"&&kind!="expense")){res.status=400;res.set_content(error_json("Choose income or expense and enter an amount above zero.").dump(),"application/json");return;}
        if(!valid_date(date)){res.status=400;res.set_content(error_json("Choose a valid date.").dump(),"application/json");return;}
        sqlite3_stmt* s=nullptr;const char* sql="INSERT INTO transactions(title,category,amount,kind,date) VALUES(?,?,?,?,?)";
        sqlite3_prepare_v2(db,sql,-1,&s,nullptr);
        sqlite3_bind_text(s,1,title.c_str(),-1,SQLITE_TRANSIENT);sqlite3_bind_text(s,2,category.c_str(),-1,SQLITE_TRANSIENT);
        sqlite3_bind_double(s,3,amount);sqlite3_bind_text(s,4,kind.c_str(),-1,SQLITE_TRANSIENT);sqlite3_bind_text(s,5,date.c_str(),-1,SQLITE_TRANSIENT);
        bool ok=sqlite3_step(s)==SQLITE_DONE;int id=(int)sqlite3_last_insert_rowid(db);sqlite3_finalize(s);
        if(!ok){res.status=500;res.set_content(error_json("Could not add transaction.").dump(),"application/json");return;}
        res.status=201;res.set_content(json{{"ok",true},{"message","Transaction added."},{"id",id}}.dump(),"application/json");
    });

    server.Delete(R"(/api/transactions/(\d+))", [](const httplib::Request& req, httplib::Response& res) {
        int id=std::stoi(req.matches[1]);sqlite3_stmt* s=nullptr;sqlite3_prepare_v2(db,"DELETE FROM transactions WHERE id=?",-1,&s,nullptr);
        sqlite3_bind_int(s,1,id);sqlite3_step(s);int changed=sqlite3_changes(db);sqlite3_finalize(s);
        if(!changed){res.status=404;res.set_content(error_json("Transaction not found.").dump(),"application/json");return;}
        res.set_content(json{{"ok",true},{"message","Transaction deleted."}}.dump(),"application/json");
    });

    server.Post("/api/goals", [](const httplib::Request& req, httplib::Response& res) {
        json d=json::parse(req.body,nullptr,false);
        if(d.is_discarded()){res.status=400;res.set_content(error_json("Invalid JSON.").dump(),"application/json");return;}
        std::string title=get_string(d,"title");double target,saved=0;
        if(!get_number(d,"target",target)){res.status=400;res.set_content(error_json("Goal amounts must be numbers.").dump(),"application/json");return;}
        if(d.contains("saved")&&!get_number(d,"saved",saved)){res.status=400;res.set_content(error_json("Goal amounts must be numbers.").dump(),"application/json");return;}
        if(title.empty()||target<=0||saved<0){res.status=400;res.set_content(error_json("Enter a goal name, a positive target, and a non-negative saved amount.").dump(),"application/json");return;}
        sqlite3_stmt* s=nullptr;sqlite3_prepare_v2(db,"INSERT INTO goals(title,target,saved) VALUES(?,?,?)",-1,&s,nullptr);
        sqlite3_bind_text(s,1,title.c_str(),-1,SQLITE_TRANSIENT);sqlite3_bind_double(s,2,target);sqlite3_bind_double(s,3,saved);
        bool ok=sqlite3_step(s)==SQLITE_DONE;int id=(int)sqlite3_last_insert_rowid(db);sqlite3_finalize(s);
        if(!ok){res.status=500;res.set_content(error_json("Could not create goal.").dump(),"application/json");return;}
        res.status=201;res.set_content(json{{"ok",true},{"message","Goal created."},{"id",id}}.dump(),"application/json");
    });

    server.Patch(R"(/api/goals/(\d+))", [](const httplib::Request& req, httplib::Response& res) {
        int id=std::stoi(req.matches[1]);json d=json::parse(req.body,nullptr,false);double saved;
        if(d.is_discarded()||!get_number(d,"saved",saved)||saved<0){res.status=400;res.set_content(error_json("Saved amount must be a non-negative number.").dump(),"application/json");return;}
        sqlite3_stmt* s=nullptr;sqlite3_prepare_v2(db,"UPDATE goals SET saved=? WHERE id=?",-1,&s,nullptr);
        sqlite3_bind_double(s,1,saved);sqlite3_bind_int(s,2,id);sqlite3_step(s);int changed=sqlite3_changes(db);sqlite3_finalize(s);
        if(!changed){res.status=404;res.set_content(error_json("Goal not found.").dump(),"application/json");return;}
        res.set_content(json{{"ok",true},{"message","Goal progress updated."}}.dump(),"application/json");
    });

    server.Delete(R"(/api/goals/(\d+))", [](const httplib::Request& req, httplib::Response& res) {
        int id=std::stoi(req.matches[1]);sqlite3_stmt* s=nullptr;sqlite3_prepare_v2(db,"DELETE FROM goals WHERE id=?",-1,&s,nullptr);
        sqlite3_bind_int(s,1,id);sqlite3_step(s);int changed=sqlite3_changes(db);sqlite3_finalize(s);
        if(!changed){res.status=404;res.set_content(error_json("Goal not found.").dump(),"application/json");return;}
        res.set_content(json{{"ok",true},{"message","Goal deleted."}}.dump(),"application/json");
    });

    int port = std::stoi(env_or("PORT", "5000"));
    std::cout << "Maison Money C++ server running at http://127.0.0.1:" << port << "\n";
    bool listening = server.listen("0.0.0.0", port);
    sqlite3_close(db);
    return listening ? 0 : 1;
}
