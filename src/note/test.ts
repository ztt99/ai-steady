if (true) {
  var a = 1;
  let b = 2;
}

console.log(a); // 不报错
console.log(b); // 报 no-undef

{
  let x = 1;
}
console.log(x); // 报错

function foo() {
  if (true) {
    var a = 1;
  }
  console.log(a); // 不报错
}
