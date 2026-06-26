import { createContext, useState, useEffect } from "react"
import { useNavigate } from "react-router";

export const TesterContext = createContext();

export const TesterProvider = ({children}) => {
    const navigate = useNavigate();

    const [tester, setTester] = useState(null);
    const [login, setLogin] = useState(false)

    const value = {
        navigate,
        tester,
        setTester,
        login,
        setLogin
    };

    return (
        <TesterContext.Provider value={value}>
            {children}
        </TesterContext.Provider>
    );

}