import React from 'react'
import { useContext } from "react"
import { TesterContext } from '../context/TesterContext';

const Home = () => {
    const {login, setLogin} = useContext(TesterContext);

  return (
    <div>
        <div className="flex flex-col items-center justify-center gap-6 py-20 animate-fade-in">
            <h1 className="text-4xl text-muted-foreground max-w-2xl mx-auto animate-slide-up title">Bem-Vindo(a) ao QATry</h1>
            <p className="text-lg text-gray-600 text-muted-foreground max-w-2xl mx-auto animate-slide-up">Sua solução definitiva de automação de QA</p>
            
            <p className="text-base text-gray-600 text-muted-foreground max-w-2xl mx-auto animate-slide-up">
                Automação desenvolvida para facilitar e ajudar testar aplicações web, com foco em testes de interface e usabilidade Com o QATry você pode criar, 
                gerenciar e executar testes de forma rápida e eficiente. Além de gerar relatórios detalhados sobre os resultados dos testes
                O QATry é a ferramenta ideal para equipes de QA que buscam agilidade e qualidade nos seus processos de teste
            </p>

            <button className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition duration-300 animate-slide-up">
                Começar
            </button>
        </div>
    </div>
  )
}

export default Home