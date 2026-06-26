import { useContext, useState, useEffect } from "react"
import { Link,useLocation  } from 'react-router-dom'
import { TesterContext } from '../context/TesterContext';

const Navbar = () => {
    const {login, setLogin} = useContext(TesterContext);
    const location = useLocation();

    const [invisible, setInvisible] = useState(false);

    useEffect(() => {
        setInvisible(location.pathname === "/login");
    }, [location.pathname]);

  return (
    <div className="relative flex items-center justify-center py-3 font-medium border-b border-gray-800 mb-7 z-30">
        {login ? ( 
         <div className="justify-between items-center gap-2 w-full px-12 flex">
            <Link to="/" className="relative z-10">
                <h2 className='font-extrabold text-white text-lg'>QATry</h2>
            </Link>
            <div className={`flex justify-center items-center gap-5 ${invisible ? "hidden" : ""}`}>
                <Link to="/" className="relative z-10 text-white hover:text-gray-300 transition duration-300">
                    Início
                </Link>
                <Link to="/relatorios" className="relative z-10 text-white hover:text-gray-300 transition duration-300">
                    Relatórios
                </Link>
                <Link to="/historico" className="relative z-10 text-white hover:text-gray-300 transition duration-300">
                    Histórico
                </Link>
                <Link to="/projetos" className="relative z-10 text-white hover:text-gray-300 transition duration-300">
                    Projetos
                </Link>
            </div>
            <Link to="/perfil" className="relative z-10 flex items-center gap-2 text-white hover:text-gray-300 transition duration-300">
                <i className="fa-solid fa-user w-4 text-center"></i> Perfil
            </Link>
        </div>
        ) : (
         <div className="justify-between items-center gap-2 w-full px-12 flex">
                <Link to="/" className="relative z-10">
                    <h2 className='font-extrabold text-white text-lg'>QATry</h2>
                </Link>
            <div className={`flex justify-center items-center gap-2 ${invisible ? "hidden" : ""}`}>
                <Link to="/login" className="relative z-10">
                    <button className="text-white px-6 py-[5px] rounded-lg hover:text-gray-300 transition duration-300">
                        Entrar <i className="fa-solid fa-arrow-right text-[.8rem]"></i>
                    </button>
                </Link>
            </div>
        </div>
        )}
    </div>
  )
}

export default Navbar