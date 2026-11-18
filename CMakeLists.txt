cmake_minimum_required(VERSION 3.20)

project(MaisonMoney LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(SQLite3 REQUIRED)

add_executable(maison_money src_main.cpp)

target_include_directories(maison_money PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}
)

target_link_libraries(maison_money PRIVATE
    SQLite::SQLite3
)

if(WIN32)
    target_link_libraries(maison_money PRIVATE ws2_32)
endif()