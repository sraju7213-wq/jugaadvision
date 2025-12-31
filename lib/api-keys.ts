
export const FREE_KEYS = [
    "AIzaSyCaUu_NhY8qe_UKQM4P4XsSeV1JTPdjy8E", "AIzaSyCFGG2ousRvA1QSUEZ4XAYGcqdiJ9y92m0",
    "AIzaSyB1Uf5gbkCSRFbowB0LHuaDtV4k16xQl-A", "AIzaSyBBfYLxZf7fJHDaC61C5-OpCKxxBGUIBcA",
    "AIzaSyCEW54h0f_kA9oSV80YORfTIB3VUldNf9c", "AIzaSyBQfL3fW7R0uCtLNvQ43smbKsXZgK8ROB0",
    "AIzaSyDOYZFrgtNYX4LPosdyZxEz8-z3r3zf2wQ", "AIzaSyCHIvPN8F_IVePo9ryvCj_tP_u50GCkZ4Y",
    "AIzaSyA-y4PjAR1qMBmnrVEomzghWx3xOcsNX_Y", "AIzaSyBsUZ_S1e2EnYOFJi6OW0yD6LmHmVPNy3s"
];

export const PREMIUM_KEYS = [
    "AIzaSyB_syGwJHKAbH_nHq0s8mfbErCYhxDLxSM", "AIzaSyC1Vi5x7GkA7DNDhJ31U2imKlnyTep34BY",
    "AIzaSyA6ikVysIFGMEaMKJMewf68PWaAowF1OAY", "AIzaSyDI5FYMNvtyqvDLgS-MU2psZdUvuhbgNlc",
    "AIzaSyCpC10CcBf4pit3hx19BKl_Z9U4i2v_g90", "AIzaSyDwKQpEET0m4beH_zKgEQwkyY-JBcAvYu8",
    "AIzaSyCcgGtM7Uc3tkNNb1L_QIzcMEaC6D8CAsQ", "AIzaSyCo5CF4qyKhg8wdI0Ursuk9GNHCqM5Ps8Q",
    "AIzaSyD9GppEtGaU0M4G1OQC-YooOnXTQnb7Gcc", "AIzaSyAp16aC0Sh4m2iXs2NJb7-zZ68l8JQ-DyE",
    "AIzaSyDXMHz0OER6A3E_SiqEOF8wl0eWmJe4Ouw", "AIzaSyANVQE3wZy5sresceC5X_tdzK0z5OvoAgk",
    "AIzaSyD_5MYOsDiOjYbEz93O77OpKDgWCEZ88DQ", "AIzaSyBA5iVkpR8EU2n43Ekz_bwOgKUuQ4gOBXk",
    "AIzaSyAkodC480CAm8KEuknQaz3uuC95ONNowQg", "AIzaSyCwxYq1ZxBnPD0tHAp_e5MfXzDpQxaf2CM",
    "AIzaSyAkodC480CAm8KEuknQaz3uuC95ONNowQg", "AIzaSyCANlLh2I_P7OamtRA7SekHrutqGYlDwh8",
    "AIzaSyAi7_N1N0pz3gJeu-kXDlLCz7SoJiIRwbM", "AIzaSyB5kGs1DSY-rF8JwpF8vT8_7F5Idwpx9gk"
];

export const getRandomKey = (type: 'FREE' | 'PREMIUM') => {
    const keys = type === 'PREMIUM' ? PREMIUM_KEYS : FREE_KEYS;
    return keys[Math.floor(Math.random() * keys.length)];
};
