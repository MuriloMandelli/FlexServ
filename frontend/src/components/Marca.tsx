// Marca do sistema: o simbolo "TF" da TecFlex + o nome FlexServ.
// Substitui a logo horizontal (que tem fundo branco e nao combina com o tema escuro).

export function SimboloTF({ tamanho = 36 }: { tamanho?: number }) {
  return (
    <img
      src="/logo-tf.jpg"
      alt=""
      width={tamanho}
      height={tamanho}
      className="shrink-0 rounded-[22%] bg-white object-contain shadow-sm shadow-black/40"
      style={{ width: tamanho, height: tamanho }}
    />
  );
}

export function Marca({ grande = false }: { grande?: boolean }) {
  return (
    <span className="flex items-center gap-3" aria-label="FlexServ, TecFlex">
      <SimboloTF tamanho={grande ? 56 : 36} />
      <span className="flex flex-col leading-none">
        <span className={`font-bold tracking-tight ${grande ? "text-3xl" : "text-lg"}`}>
          Flex<span className="text-primaria">Serv</span>
        </span>
        <span className={`mt-1 font-medium uppercase tracking-[0.2em] text-suave ${grande ? "text-xs" : "text-[10px]"}`}>
          TecFlex
        </span>
      </span>
    </span>
  );
}
