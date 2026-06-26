import React from 'react'
import { useState } from 'react'
import { ToastContainer } from 'react-toastify';
import { toast } from 'react-toastify';

const Login = () => {
  const [signup, setSignup] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
  })

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-20">
      <ToastContainer position="top-right" autoClose={4000} />

      <h2 className='font-bold text-4xl text-left'>{signup ? "Cadastrar-se" : "Entrar"}</h2>
      <form action="" className="flex flex-col items-center justify-center gap-5 py-5 w-full max-w-md px-8">
        {signup ? (
          <>
            <button className="border border-gray-500 rounded-lg px-3 py-1 text-white w-full cursor-pointer hover:bg-gray-500 transition duration-200" type="submit">Continue com o Google</button>

            <hr className='border-b-[-5px] border-gray-500 w-64' />

            <div className="inputs flex flex-col items-center justify-center gap-4 w-full">
              <input type="email" placeholder="tester@example.com" className="w-full border border-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-blue-500" />
              <input type="password" placeholder="Senha" className="w-full border border-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-blue-500" />
              {/* confirm senha */}
              <input type="password" placeholder="Confirmar senha" className="w-full border border-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-blue-500" />

              <button type="submit" className="w-full bg-white text-black px-6 py-2 rounded-lg cursor-pointer hover:bg-gray-300 transition duration-300">
                  Cadastrar-se <i class="fa-solid fa-arrow-right text-[.8rem]"></i>
              </button>
            </div>
            <p> 
              Já tem uma conta? <span onClick={() => setSignup(false)} className="text-white hover:text-blue-300 transition duration-300">Faça login</span>
            </p>
          </>
        ) : (
          <>     
            <button className="border border-gray-500 rounded-lg px-3 py-1 text-white w-full cursor-pointer hover:bg-gray-500 transition duration-200" type="submit">Continue com o Google</button>

            <hr className='border-b-[-5px] border-gray-500 w-64' />

            <div className="inputs flex flex-col items-center justify-center gap-4 w-full">
              <input type="email" placeholder="Email" className="w-full border border-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-blue-500" />
              <input type="password" placeholder="Senha" className="w-full border border-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-blue-500" />
              <button type="submit" className="w-full bg-white text-black px-6 py-2 rounded-lg cursor-pointer hover:bg-gray-300 transition duration-300">
                Continuar
              </button>
            </div>
            <p>Não tem uma conta ainda? <span onClick={() => setSignup(true)} className="text-white hover:text-blue-300 transition duration-300">Cadastrar-se</span> </p>
          </>
        )}
      </form>
    </div>
  )
}

export default Login