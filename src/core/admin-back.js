// Shared context for the admin Back-button guard. Modules that open an internal screen (a program
// console or a drill-down) register a "go back one step" handler; the admin shell (admin-app.jsx)
// calls it on browser Back before falling back to the previous tab, so Back never leaves admin.
import React from "react";
export const AdminBackContext = React.createContext(null);
