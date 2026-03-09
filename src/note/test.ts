// if (true) {
//   var a = 1;
//   let b = 2;
// }

// console.log(a); // 不报错
// console.log(b); // 报 no-undef

// {
//   let x = 1;
// }
// console.log(x); // 报错

// function foo() {
//   if (true) {
//     var a = 1;
//   }
//   console.log(a); // 不报错
// }

// function outer() {
//   function inner() {
//     var a = 1;
//   }

//   if (true) {
//     var c = 1;
//   }

//   if (true) var b = 1;
// }

// foo(); // OK
// function foo() {}

// bar(); // undefined variable
// console.log(a); // OK

// var a = 1;

// console.log(b); // TDZ
// let b = 1;

function fn() {
  console.log(a);
  var a = 1;
  console.log(b);

  let b = 2;
}
